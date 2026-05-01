import React, { useEffect, useRef, useState } from "react";
import UserAvatar from "./UserAvatar";
import { useAuth } from "../context/AuthContext";

const menuBtn = {
  display: "block",
  width: "100%",
  padding: "10px 14px",
  border: "none",
  background: "#fff",
  textAlign: "left",
  cursor: "pointer",
  fontSize: 14,
};

const ProfileAvatarMenu = ({ user, size = 24 }) => {
  const { logout, uploadProfilePicture } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await uploadProfilePicture(file);
    } catch (err) {
      window.alert(err.message || "Upload failed");
    }
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        style={{
          border: "none",
          padding: 0,
          margin: 0,
          background: "transparent",
          cursor: "pointer",
          borderRadius: "50%",
          lineHeight: 0,
          display: "block",
        }}
      >
        <UserAvatar user={user} size={size} />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={onPickFile}
      />
      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 6,
            minWidth: 200,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 6,
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            role="menuitem"
            style={menuBtn}
            onClick={() => fileRef.current?.click()}
          >
            Change profile picture
          </button>
          <button
            type="button"
            role="menuitem"
            style={{ ...menuBtn, borderTop: "1px solid #eee" }}
            onClick={() => {
              logout();
              setOpen(false);
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default ProfileAvatarMenu;
