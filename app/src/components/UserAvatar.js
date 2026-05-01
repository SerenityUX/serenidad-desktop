import React, { useState } from "react";

const UserAvatar = ({ user, size = 40 }) => {
  const [imgErr, setImgErr] = useState(false);
  const url =
    user?.profile_picture && String(user.profile_picture).trim() && !imgErr
      ? user.profile_picture.trim()
      : null;

  const letterRaw = (user?.name || user?.email || "?").trim();
  const letter =
    letterRaw.length > 0 ? letterRaw.charAt(0).toUpperCase() : "?";

  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        style={{
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
        }}
        onError={() => setImgErr(true)}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "#F2F2F2",
        color: "#BFBFBF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.42),
        fontWeight: 600,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {letter}
    </div>
  );
};

export default UserAvatar;
