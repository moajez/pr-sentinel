import base64
import time

import httpx
import jwt

from app.config import Settings, get_settings

_HEADERS = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}


def create_app_jwt(app_id: str, private_key: str) -> str:
    """RS256 JWT identifying the GitHub App (valid <10 min)."""
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 9 * 60, "iss": app_id}
    return jwt.encode(payload, private_key.replace("\\n", "\n"), algorithm="RS256")


class GitHubClient:
    """Minimal async GitHub REST client authenticated as an installation."""

    def __init__(self, installation_id: int, settings: Settings | None = None,
                 http: httpx.AsyncClient | None = None):
        self.installation_id = installation_id
        self.settings = settings or get_settings()
        self._http = http or httpx.AsyncClient(base_url=self.settings.github_api_url, timeout=30)
        self._token: str | None = None

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _installation_token(self) -> str:
        if self._token:
            return self._token
        app_jwt = create_app_jwt(self.settings.github_app_id, self.settings.github_private_key)
        resp = await self._http.post(
            f"/app/installations/{self.installation_id}/access_tokens",
            headers={**_HEADERS, "Authorization": f"Bearer {app_jwt}"},
        )
        resp.raise_for_status()
        self._token = resp.json()["token"]
        return self._token

    async def _request(self, method: str, url: str, accept: str | None = None, **kw) -> httpx.Response:
        headers = {**_HEADERS, "Authorization": f"Bearer {await self._installation_token()}"}
        if accept:
            headers["Accept"] = accept
        resp = await self._http.request(method, url, headers=headers, **kw)
        resp.raise_for_status()
        return resp

    async def get_pull_request_files(self, owner: str, repo: str, number: int) -> list[dict]:
        """List changed files (with per-file `patch`), paginated."""
        files: list[dict] = []
        page = 1
        while True:
            resp = await self._request(
                "GET", f"/repos/{owner}/{repo}/pulls/{number}/files",
                params={"per_page": 100, "page": page},
            )
            batch = resp.json()
            files.extend(batch)
            if len(batch) < 100:
                return files
            page += 1

    async def get_pull_request_diff(self, owner: str, repo: str, number: int) -> str:
        resp = await self._request(
            "GET", f"/repos/{owner}/{repo}/pulls/{number}",
            accept="application/vnd.github.v3.diff",
        )
        return resp.text

    async def create_review(self, owner: str, repo: str, number: int, commit_sha: str,
                            body: str, comments: list[dict]) -> dict:
        resp = await self._request(
            "POST", f"/repos/{owner}/{repo}/pulls/{number}/reviews",
            json={"commit_id": commit_sha, "body": body, "event": "COMMENT", "comments": comments},
        )
        return resp.json()

    async def create_issue_comment(self, owner: str, repo: str, number: int, body: str) -> dict:
        resp = await self._request(
            "POST", f"/repos/{owner}/{repo}/issues/{number}/comments", json={"body": body}
        )
        return resp.json()


    async def create_check_run(self, owner: str, repo: str, head_sha: str, name: str = "PR Sentinel") -> dict:
        resp = await self._request(
            "POST", f"/repos/{owner}/{repo}/check-runs",
            json={"name": name, "head_sha": head_sha, "status": "in_progress"},
        )
        return resp.json()

    async def complete_check_run(self, owner: str, repo: str, check_run_id: int, conclusion: str,
                                 title: str, summary: str) -> dict:
        """conclusion: success | failure | neutral | cancelled | ..."""
        resp = await self._request(
            "PATCH", f"/repos/{owner}/{repo}/check-runs/{check_run_id}",
            json={"status": "completed", "conclusion": conclusion,
                  "output": {"title": title, "summary": summary[:60000]}},
        )
        return resp.json()

    async def get_file(self, owner: str, repo: str, path: str, ref: str) -> dict:
        resp = await self._request("GET", f"/repos/{owner}/{repo}/contents/{path}", params={"ref": ref})
        return resp.json()

    async def create_branch(self, owner: str, repo: str, branch: str, sha: str) -> dict:
        resp = await self._request("POST", f"/repos/{owner}/{repo}/git/refs",
                                   json={"ref": f"refs/heads/{branch}", "sha": sha})
        return resp.json()

    async def put_file(self, owner: str, repo: str, path: str, content: str, blob_sha: str,
                       branch: str, message: str) -> dict:
        resp = await self._request(
            "PUT", f"/repos/{owner}/{repo}/contents/{path}",
            json={"message": message, "content": base64.b64encode(content.encode()).decode(),
                  "sha": blob_sha, "branch": branch})
        return resp.json()

    async def create_pull(self, owner: str, repo: str, title: str, head: str, base: str, body: str, draft: bool = True) -> dict:
        payload = {"title": title, "head": head, "base": base, "body": body, "draft": draft}
        resp = await self._request("POST", f"/repos/{owner}/{repo}/pulls", json=payload)
        return resp.json()
