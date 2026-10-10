from typing import Optional

from pydantic import BaseModel


class Owner(BaseModel):
    login: str


class Repository(BaseModel):
    id: int
    name: str
    full_name: str
    owner: Owner


class Ref(BaseModel):
    sha: str
    ref: str = ""


class User(BaseModel):
    login: str


class PullRequest(BaseModel):
    number: int
    title: str = ""
    user: Optional[User] = None
    head: Ref
    base: Ref
    draft: bool = False


class Installation(BaseModel):
    id: int


class PullRequestEvent(BaseModel):
    action: str
    pull_request: PullRequest
    repository: Repository
    installation: Optional[Installation] = None

