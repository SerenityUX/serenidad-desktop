import React, { useEffect, useState } from "react";

const UserAvatar = ({ user, size = 24 }) => {
  const [imgErr, setImgErr] = useState(false);
  const rawUrl = user?.profile_picture && String(user.profile_picture).trim();
  const url = rawUrl && !imgErr ? rawUrl : null;

  useEffect(() => {
    setImgErr(false);
  }, [rawUrl]);

  const letterRaw = (user?.name || user?.email || "?").trim();
  const letter =
    letterRaw.length > 0 ? letterRaw.charAt(0).toUpperCase() : "?";

  const letterFont = Math.max(10, Math.round(size * 0.42));

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        backgroundColor: url ? "transparent" : "#BFBFBF",
        color: "#F2F2F2",
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          onError={() => setImgErr(true)}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: letterFont,
            fontWeight: 600,
            userSelect: "none",
          }}
        >
          {letter}
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
