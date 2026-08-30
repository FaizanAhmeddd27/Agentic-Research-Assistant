"""Memory API — list and delete long-term memory entries.

Memory entries are stored via the LangGraph Store, namespaced by user_id.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import get_current_user

router = APIRouter(prefix="/api/memory", tags=["memory"])


@router.get("/")
def list_user_memories(user_id: str = Depends(get_current_user)):
    from app.db.store import get_store
    from app.db.memory import list_memories

    store = get_store()
    memories = list_memories(store, user_id)
    return {"user_id": user_id, "memories": memories, "count": len(memories)}


@router.delete("/{memory_key}")
def delete_user_memory(memory_key: str, user_id: str = Depends(get_current_user)):
    from app.db.store import get_store
    from app.db.memory import delete_memory

    store = get_store()
    try:
        delete_memory(store, user_id, memory_key)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"deleted": True, "key": memory_key}
