import { useRef, useState, type FormEvent } from "react";
import { useDialogFocus } from "./useDialogFocus";

interface Props {
  title: string;
  initialName?: string;
  submitLabel?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export function UserTemplateNameDialog({ title, initialName = "", submitLabel = "保存", onSubmit, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  useDialogFocus(dialogRef, { onClose });

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized) {
      setError("名前を入力してください");
      return;
    }
    onSubmit(normalized);
  }

  return (
    <div className="dialog-backdrop">
      <form ref={dialogRef} className="dialog user-template-name-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onSubmit={submit}>
        <h2>{title}</h2>
        <p className="hint">選択物の相対配置・寸法・表示設定を保存します。背景や舞台設定は含まれません。</p>
        <label>
          テンプレート名
          <input
            autoFocus
            value={name}
            maxLength={100}
            onChange={(event) => { setName(event.target.value); setError(null); }}
            aria-invalid={error !== null}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>キャンセル</button>
          <button type="submit" className="primary">{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}
