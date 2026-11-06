import pathlib, sys

p = pathlib.Path("src/fr.js")
t = p.read_text()


def rep(old, new, count=1):
    global t
    n = t.count(old)
    if n != count:
        sys.exit(f"expected {count} match, got {n}: {old[:90]!r}")
    t = t.replace(old, new)


# --- A. labels --------------------------------------------------------------
rep(
    """            signIn: "Sign in with Freebuff",""",
    """            profile: "My profile",
            signIn: "Sign in with Freebuff",""",
)
rep(
    """              signIn: "Entrar con Freebuff",""",
    """              profile: "Mi perfil",
              signIn: "Entrar con Freebuff",""",
)
rep(
    """              signIn: "Entrar com Freebuff",""",
    """              profile: "Meu perfil",
              signIn: "Entrar com Freebuff",""",
)

# --- B. state ---------------------------------------------------------------
rep(
    """    [accountMenu, setAccountMenu] = Y.useState(!1),""",
    """    [accountMenu, setAccountMenu] = Y.useState(!1),
    [profile, setProfile] = Y.useState(null),
    [profileDraft, setProfileDraft] = Y.useState(null),
    [profilePeek, setProfilePeek] = Y.useState(null),
    [friends, setFriends] = Y.useState({ friend: [], incoming: [], outgoing: [] }),
    [friendQuery, setFriendQuery] = Y.useState(""),
    [friendResults, setFriendResults] = Y.useState([]),""",
)

# --- C. profile + friends logic --------------------------------------------
rep(
    """    addGuide = (i) => {""",
    """    loadFriendsNow = async () => {
      try {
        setFriends(await bu("/api/friends", "GET"));
      } catch {}
    },
    openMyProfile = async () => {
      (setAccountMenu(!1), Ve("profile"), setProfilePeek(null));
      try {
        const i = await bu("/api/profile", "GET");
        (setProfile(i.profile), setProfileDraft(i.profile));
        await loadFriendsNow();
      } catch (i) {
        He("Não foi possível carregar o perfil", i.message);
      }
    },
    openProfile = async (i) => {
      if (!i) return;
      try {
        const s = await bu(`/api/profiles/${encodeURIComponent(i)}`, "GET");
        (setProfilePeek(s), setProfileDraft(null), setFriendResults([]), Ve("profile"));
      } catch (s) {
        He("Perfil indisponível", s.message);
      }
    },
    saveProfile = async () => {
      if (!profileDraft) return;
      try {
        const i = await bu("/api/profile", "PUT", {
          username: profileDraft.username || "",
          displayName: profileDraft.displayName || "",
          bio: profileDraft.bio || "",
          avatar: profileDraft.avatar || "",
          banner: profileDraft.banner || "",
          bannerImage: profileDraft.bannerImage || "",
        });
        (setProfile(i.profile), setProfileDraft(i.profile), He("Perfil salvo"));
      } catch (i) {
        He("Não foi possível salvar o perfil", i.message);
      }
    },
    pickProfileImage = (i, s, h) => {
      const y = i.target.files && i.target.files[0];
      if (!y) return;
      const R = new FileReader();
      ((R.onload = () => {
        const U = new Image();
        ((U.onload = () => {
          const X = Math.min(1, h / Math.max(U.width, U.height)),
            $ = document.createElement("canvas");
          (($.width = Math.max(1, Math.round(U.width * X))),
            ($.height = Math.max(1, Math.round(U.height * X))));
          const se = $.getContext("2d");
          (se.drawImage(U, 0, 0, $.width, $.height),
            setProfileDraft((be) => ({
              ...be,
              [s]: $.toDataURL("image/jpeg", s === "avatar" ? 0.86 : 0.82),
            })));
        }),
          (U.src = R.result));
      }),
        R.readAsDataURL(y));
    },
    searchPeople = async () => {
      const i = friendQuery.trim().toLowerCase();
      if (i.length < 2) return;
      try {
        const s = await bu(
          `/api/users/search?q=${encodeURIComponent(i)}`,
          "GET",
        );
        setFriendResults(s.people || []);
      } catch (s) {
        He("Busca indisponível", s.message);
      }
    },
    addFriend = async (i) => {
      if (!i) return;
      try {
        const s = await bu("/api/friends/request", "POST", { username: i });
        (He(s.state === "friend" ? "Agora vocês são amigos" : "Pedido enviado"),
          setFriendResults((h) =>
            h.map((y) => (y.username === i ? { ...y, friend: s.state } : y)),
          ),
          await loadFriendsNow());
      } catch (s) {
        He("Não foi possível enviar o pedido", s.message);
      }
    },
    respondFriend = async (i, s) => {
      try {
        (await bu("/api/friends/respond", "POST", { id: i, accept: !!s }),
          await loadFriendsNow(),
          setProfilePeek(null));
      } catch (h) {
        He("Não foi possível responder", h.message);
      }
    },
    profileCard = (i, s) =>
      i
        ? r.createElement(
            "div",
            {
              className: `profile-card${s ? " large" : ""}`,
              style: i.bannerImage
                ? {
                    backgroundImage: `url(${i.bannerImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : { background: i.banner || "#9585ed" },
            },
            r.createElement(
              "div",
              { className: "profile-card-inner" },
              i.avatar
                ? r.createElement("img", {
                    className: "profile-avatar",
                    src: i.avatar,
                    alt: "",
                  })
                : r.createElement(
                    "span",
                    { className: "profile-avatar initials" },
                    ((i.displayName || i.username || "F").trim()[0] || "F").toUpperCase(),
                  ),
              r.createElement("b", null, i.displayName || i.username || "Framia"),
              i.username
                ? r.createElement("small", null, `@${i.username}`)
                : null,
              i.bio ? r.createElement("p", null, i.bio) : null,
            ),
          )
        : null,
    addGuide = (i) => {""",
)

# --- D. account menu entry --------------------------------------------------
rep(
    """                  r.createElement(
                    "form",
                    { action: "/auth/freebuff/signout", method: "POST" },""",
    """                  r.createElement(
                    "button",
                    {
                      type: "button",
                      className: "account-profile",
                      onClick: () => openMyProfile(),
                    },
                    accountLabels.profile,
                  ),
                  r.createElement(
                    "form",
                    { action: "/auth/freebuff/signout", method: "POST" },""",
)

# --- E. modal body ----------------------------------------------------------
rep(
    """              Oe === "shortcuts"
                ? r.createElement(""",
    """              Oe === "profile"
                ? r.createElement(
                    "div",
                    { className: "modal-body profile-body" },
                    profilePeek
                      ? r.createElement(
                          r.Fragment,
                          null,
                          profileCard(profilePeek.profile, !0),
                          r.createElement(
                            "div",
                            { className: "profile-actions" },
                            profilePeek.friend && profilePeek.friend.state === "friend"
                              ? r.createElement(
                                  "span",
                                  { className: "profile-badge" },
                                  "Amigos",
                                )
                              : profilePeek.friend &&
                                  profilePeek.friend.state === "outgoing"
                                ? r.createElement(
                                    "span",
                                    { className: "profile-badge" },
                                    "Pedido enviado",
                                  )
                                : profilePeek.friend &&
                                    profilePeek.friend.state === "incoming"
                                  ? r.createElement(
                                      "button",
                                      {
                                        type: "button",
                                        className: "primary-button",
                                        onClick: () =>
                                          respondFriend(profilePeek.friend.id, !0),
                                      },
                                      "Aceitar pedido de amizade",
                                    )
                                  : r.createElement(
                                      "button",
                                      {
                                        type: "button",
                                        className: "primary-button",
                                        disabled: !profilePeek.profile.username,
                                        onClick: () =>
                                          addFriend(profilePeek.profile.username),
                                      },
                                      profilePeek.profile.username
                                        ? "Adicionar amigo"
                                        : "Esta pessoa ainda não escolheu um @",
                                    ),
                          ),
                        )
                      : profileDraft
                        ? r.createElement(
                            r.Fragment,
                            null,
                            profileCard(profileDraft, !0),
                            !profileDraft.username &&
                              r.createElement(
                                "label",
                                { className: "profile-field" },
                                "Nome de usuário (permanente)",
                                r.createElement("input", {
                                  value: profileDraft.username || "",
                                  placeholder: "seu_nome",
                                  maxLength: 20,
                                  onChange: (i) =>
                                    setProfileDraft((s) => ({
                                      ...s,
                                      username: i.target.value
                                        .toLowerCase()
                                        .replace(/[^a-z0-9_]/g, ""),
                                    })),
                                }),
                              ),
                            r.createElement(
                              "label",
                              { className: "profile-field" },
                              "Nome de exibição",
                              r.createElement("input", {
                                value: profileDraft.displayName || "",
                                maxLength: 40,
                                onChange: (i) =>
                                  setProfileDraft((s) => ({
                                    ...s,
                                    displayName: i.target.value,
                                  })),
                              }),
                            ),
                            r.createElement(
                              "label",
                              { className: "profile-field" },
                              "Bio",
                              r.createElement("textarea", {
                                value: profileDraft.bio || "",
                                maxLength: 280,
                                rows: 3,
                                onChange: (i) =>
                                  setProfileDraft((s) => ({
                                    ...s,
                                    bio: i.target.value,
                                  })),
                              }),
                            ),
                            r.createElement(
                              "div",
                              { className: "profile-banners" },
                              [
                                "linear-gradient(135deg,#9585ed,#54bfe9)",
                                "linear-gradient(135deg,#f36083,#ffb86b)",
                                "linear-gradient(135deg,#54bfe9,#3ddc97)",
                                "linear-gradient(135deg,#2b2f45,#9585ed)",
                                "linear-gradient(135deg,#ffb86b,#f36083)",
                                "linear-gradient(135deg,#1b1d27,#3ddc97)",
                              ].map((i) =>
                                r.createElement("button", {
                                  key: i,
                                  type: "button",
                                  className:
                                    profileDraft.banner === i
                                      ? "profile-swatch selected"
                                      : "profile-swatch",
                                  style: { background: i },
                                  "aria-label": "Cor do banner",
                                  onClick: () =>
                                    setProfileDraft((s) => ({
                                      ...s,
                                      banner: i,
                                      bannerImage: "",
                                    })),
                                }),
                              ),
                              r.createElement("input", {
                                type: "color",
                                className: "profile-color",
                                value: /^#[0-9a-f]{6}$/i.test(
                                  profileDraft.banner || "",
                                )
                                  ? profileDraft.banner
                                  : "#9585ed",
                                onChange: (i) =>
                                  setProfileDraft((s) => ({
                                    ...s,
                                    banner: i.target.value,
                                    bannerImage: "",
                                  })),
                              }),
                              r.createElement(
                                "label",
                                { className: "profile-upload" },
                                "Banner (imagem/GIF)",
                                r.createElement("input", {
                                  type: "file",
                                  accept: "image/*",
                                  onChange: (i) =>
                                    pickProfileImage(i, "bannerImage", 1200),
                                }),
                              ),
                              r.createElement(
                                "label",
                                { className: "profile-upload" },
                                "Avatar",
                                r.createElement("input", {
                                  type: "file",
                                  accept: "image/*",
                                  onChange: (i) =>
                                    pickProfileImage(i, "avatar", 256),
                                }),
                              ),
                              profileDraft.bannerImage &&
                                r.createElement(
                                  "button",
                                  {
                                    type: "button",
                                    className: "ghost-button",
                                    onClick: () =>
                                      setProfileDraft((s) => ({
                                        ...s,
                                        bannerImage: "",
                                      })),
                                  },
                                  "Remover imagem",
                                ),
                            ),
                            r.createElement(
                              "button",
                              {
                                type: "button",
                                className: "primary-button",
                                onClick: () => saveProfile(),
                              },
                              "Salvar perfil",
                            ),
                            r.createElement(
                              "section",
                              { className: "friends-section" },
                              r.createElement("h3", null, "Amigos"),
                              r.createElement(
                                "div",
                                { className: "friend-search" },
                                r.createElement("input", {
                                  value: friendQuery,
                                  placeholder: "@nome de usuário",
                                  maxLength: 20,
                                  onChange: (i) =>
                                    setFriendQuery(
                                      i.target.value.toLowerCase(),
                                    ),
                                  onKeyDown: (i) =>
                                    i.key === "Enter" && searchPeople(),
                                }),
                                r.createElement(
                                  "button",
                                  {
                                    type: "button",
                                    className: "ghost-button",
                                    onClick: () => searchPeople(),
                                  },
                                  "Buscar",
                                ),
                              ),
                              friendResults.length > 0 &&
                                r.createElement(
                                  "div",
                                  { className: "friend-list" },
                                  friendResults.map((i) =>
                                    r.createElement(
                                      "div",
                                      { className: "friend-row", key: i.id },
                                      i.avatar
                                        ? r.createElement("img", {
                                            className: "friend-avatar",
                                            src: i.avatar,
                                            alt: "",
                                          })
                                        : r.createElement(
                                            "span",
                                            { className: "friend-avatar" },
                                            (i.displayName ||
                                              i.username ||
                                              "F")[0].toUpperCase(),
                                          ),
                                      r.createElement(
                                        "div",
                                        { className: "friend-text" },
                                        r.createElement(
                                          "b",
                                          null,
                                          i.displayName || i.username,
                                        ),
                                        r.createElement(
                                          "small",
                                          null,
                                          `@${i.username}`,
                                        ),
                                      ),
                                      r.createElement(
                                        "button",
                                        {
                                          type: "button",
                                          className: "ghost-button",
                                          onClick: () => addFriend(i.username),
                                        },
                                        i.friend === "friend"
                                          ? "Amigos"
                                          : i.friend === "outgoing"
                                            ? "Pendente"
                                            : "Adicionar",
                                      ),
                                    ),
                                  ),
                                ),
                              friends.incoming.length > 0 &&
                                r.createElement(
                                  "div",
                                  { className: "friend-list" },
                                  r.createElement(
                                    "small",
                                    { className: "friend-caption" },
                                    "Pedidos recebidos",
                                  ),
                                  friends.incoming.map((i) =>
                                    r.createElement(
                                      "div",
                                      {
                                        className: "friend-row",
                                        key: i.requestId,
                                      },
                                      r.createElement(
                                        "div",
                                        { className: "friend-text" },
                                        r.createElement(
                                          "b",
                                          null,
                                          i.profile.displayName ||
                                            i.profile.username,
                                        ),
                                        r.createElement(
                                          "small",
                                          null,
                                          `@${i.profile.username}`,
                                        ),
                                      ),
                                      r.createElement(
                                        "button",
                                        {
                                          type: "button",
                                          className: "ghost-button",
                                          onClick: () =>
                                            respondFriend(i.requestId, !0),
                                        },
                                        "Aceitar",
                                      ),
                                      r.createElement(
                                        "button",
                                        {
                                          type: "button",
                                          className: "ghost-button",
                                          onClick: () =>
                                            respondFriend(i.requestId, !1),
                                        },
                                        "Recusar",
                                      ),
                                    ),
                                  ),
                                ),
                              friends.friend.length > 0 &&
                                r.createElement(
                                  "div",
                                  { className: "friend-list" },
                                  r.createElement(
                                    "small",
                                    { className: "friend-caption" },
                                    "Seus amigos",
                                  ),
                                  friends.friend.map((i) =>
                                    r.createElement(
                                      "div",
                                      {
                                        className: "friend-row",
                                        key: i.requestId,
                                      },
                                      r.createElement(
                                        "div",
                                        { className: "friend-text" },
                                        r.createElement(
                                          "b",
                                          null,
                                          i.profile.displayName ||
                                            i.profile.username,
                                        ),
                                        r.createElement(
                                          "small",
                                          null,
                                          `@${i.profile.username}`,
                                        ),
                                      ),
                                      r.createElement(
                                        "button",
                                        {
                                          type: "button",
                                          className: "ghost-button",
                                          onClick: () =>
                                            openProfile(i.profile.id),
                                        },
                                        "Perfil",
                                      ),
                                    ),
                                  ),
                                ),
                            ),
                          )
                        : r.createElement(
                            "div",
                            { className: "modal-note" },
                            "Carregando perfil...",
                          ),
                  )
                : Oe === "shortcuts"
                ? r.createElement(""",
)

# --- F. chat names open the profile ----------------------------------------
rep(
    """                      { className: "chat-message", key: i.id },
                      r.createElement("b", null, i.name),""",
    """                      { className: "chat-message", key: i.id },
                      r.createElement(
                        "b",
                        {
                          className: i.senderId ? "chat-author" : "",
                          onClick: i.senderId
                            ? () => openProfile(i.senderId)
                            : void 0,
                        },
                        i.name,
                      ),""",
)

p.write_text(t)
print("patched ui")
