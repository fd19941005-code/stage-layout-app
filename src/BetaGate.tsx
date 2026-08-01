import { useState, type FormEvent, type ReactNode } from "react";

const STORAGE_KEY = "stage-layout-beta-unlocked";
const expectedPassword = import.meta.env.VITE_BETA_PASSWORD as string | undefined;

export function BetaGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(
    () => !expectedPassword || localStorage.getItem(STORAGE_KEY) === "1",
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input === expectedPassword) {
      localStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "280px" }}
      >
        <label htmlFor="beta-password">パスワードを入力してください</label>
        <input
          id="beta-password"
          type="password"
          autoFocus
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(false);
          }}
          style={{ padding: "0.5rem", fontSize: "1rem" }}
        />
        {error && <span style={{ color: "crimson" }}>パスワードが違います</span>}
        <button type="submit" style={{ padding: "0.5rem" }}>
          入る
        </button>
      </form>
    </div>
  );
}
