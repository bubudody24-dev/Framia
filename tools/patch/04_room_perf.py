import pathlib, sys

p = pathlib.Path("src/fr.js")
t = p.read_text()


def rep(old, new, count=1):
    global t
    n = t.count(old)
    if n != count:
        sys.exit(f"expected {count} match, got {n}: {old[:90]!r}")
    t = t.replace(old, new)


# A. batch API on the room client: one GET + one PUT for a run of edits
rep(
    """  async uploadMedia(d, v) {""",
    """  mutations(d) {
    return this.enqueue(async () => {
      if (!d.length) return;
      for (let v = 0; v < 4; v++) {
        const f = await bu(`/api/rooms/${this.code}`, "GET"),
          g = structuredClone(f.project);
        for (const b of d) b(g);
        try {
          const b = await bu(`/api/rooms/${this.code}`, "PUT", {
            baseRevision: f.revision,
            project: g,
          });
          this.revision = b.revision;
          return;
        } catch (b) {
          if (b.status !== 409) throw b;
        }
      }
      throw Error("A sala mudou enquanto você editava. Tente novamente.");
    });
  }
  async uploadMedia(d, v) {""",
)

# B. debounced room queue shared by edits and undo/redo
rep(
    """  const De = Y.useCallback((i) => {""",
    """  const roomQueue = Y.useRef([]),
    roomTimer = Y.useRef(null),
    queueRoomMutation = (i) => {
      roomQueue.current.push(i);
      (clearTimeout(roomTimer.current),
        (roomTimer.current = setTimeout(() => {
          const s = roomQueue.current,
            h = Ct.current;
          ((roomQueue.current = []), h && s.length && h.mutations(s));
        }, 160)));
    };
  const De = Y.useCallback((i) => {""",
)

rep(
    """        te(h),
        (y = Ct.current) == null || y.mutation(i));
    }, []),""",
    """        te(h),
        (y = Ct.current) != null && y && queueRoomMutation(i));
    }, []),""",
)

# C. undo/redo also batch instead of one request per step
rep(
    """      ((bt.current = s),
        Ea.current.clear(),
        te(s),
        (h = Ct.current) == null ||
          h.mutation((y) => Object.assign(y, structuredClone(i))));""",
    """      ((bt.current = s),
        Ea.current.clear(),
        te(s),
        (h = Ct.current) != null &&
          h &&
          queueRoomMutation((y) => Object.assign(y, structuredClone(i))));""",
)

# D. do not push the same project to personal cloud storage while collaborating
rep(
    """                  Mt &&
                    (await gu(
                      `/api/projects/${encodeURIComponent(s.id)}`,
                      "PUT",
                      s,
                    )));""",
    """                  Mt &&
                    !Ct.current &&
                    (await gu(
                      `/api/projects/${encodeURIComponent(s.id)}`,
                      "PUT",
                      s,
                    )));""",
)

p.write_text(t)
print("patched")
