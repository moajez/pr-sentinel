from celery import Celery

from app.config import get_settings

_s = get_settings()

celery_app = Celery("sentinel", broker=_s.redis_url, backend=_s.redis_url, include=["app.tasks.review_tasks"])
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    task_acks_late=True,              # re-deliver if a worker dies mid-review
    worker_prefetch_multiplier=1,     # long LLM calls: don't hoard tasks
    task_track_started=True,
)

