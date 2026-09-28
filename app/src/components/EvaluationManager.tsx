import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Evaluation } from '../types'

interface Props {
  evaluations: Evaluation[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onImport: (text: string) => number | null
  onExportJson: () => void
  onExportCsv: () => void
  onExportSingleJson: (id: string) => void
  onPrint: () => void
  onHome: () => void
}

export function EvaluationManager({
  evaluations,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onImport,
  onExportJson,
  onExportCsv,
  onExportSingleJson,
  onPrint,
  onHome,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  function startRename(id: string, currentName: string): void {
    setRenamingId(id)
    setRenameValue(currentName)
  }

  function commitRename(): void {
    if (renamingId) {
      onRename(renamingId, renameValue)
    }
    setRenamingId(null)
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      try {
        const added = onImport(text)
        setMessage({
          kind: 'ok',
          text: (added ?? 0) + ' evaluation(s) imported.',
        })
      } catch (error) {
        setMessage({
          kind: 'error',
          text: error instanceof Error ? error.message : 'Import failed.',
        })
      }
    }
    reader.onerror = () => setMessage({ kind: 'error', text: 'Could not read the file.' })
    reader.readAsText(file)
    event.target.value = ''
  }

  function deleteRow(id: string): void {
    const item = evaluations.find((e) => e.id === id)
    if (!item) return
    if (window.confirm('Delete "' + item.name + '"? This cannot be undone on this device.')) {
      onDelete(id)
    }
  }

  function countAnswers(item: Evaluation): number {
    return Object.values(item.answers).filter((a) => typeof a.value === 'number').length
  }

  return (
    <section aria-labelledby="manager-title">
      <div className="page-head">
        <div>
          <p className="kicker">Evaluation manager</p>
          <h1 id="manager-title">My evaluations</h1>
          <p className="muted">
            Everything below is stored in this browser only. Export a JSON backup to move or
            archive your work.
          </p>
        </div>
      </div>

      <div className="manager-toolbar" role="group" aria-label="Data actions">
        <button type="button" className="primary" onClick={onCreate}>
          New evaluation
        </button>
        <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={handleImportFile}
          aria-label="Import evaluations from a JSON file"
        />
        <button type="button" className="secondary" onClick={onExportJson} disabled={evaluations.length === 0}>
          Export all (JSON)
        </button>
        <button type="button" className="secondary" onClick={onExportCsv} disabled={evaluations.length === 0}>
          Export all (CSV)
        </button>
        <button type="button" className="ghost" onClick={onPrint} disabled={!activeId}>
          Print active report
        </button>
        <button type="button" className="ghost" onClick={onHome}>
          Home
        </button>
      </div>

      {message ? (
        <p className={'status-line ' + message.kind} role="status" aria-live="polite">
          {message.text}
        </p>
      ) : null}

      {evaluations.length === 0 ? (
        <div className="card empty-state">
          <p>No evaluations yet. Create one or import a backup.</p>
        </div>
      ) : (
        <ul className="eval-list">
          {evaluations.map((item) => {
            const isActive = item.id === activeId
            const beingRenamed = renamingId === item.id
            return (
              <li key={item.id} className={'eval-row card' + (isActive ? ' is-active' : '')}>
                {beingRenamed ? (
                  <div className="eval-rename">
                    <label className="sr-only" htmlFor={'rename-' + item.id}>
                      Evaluation name
                    </label>
                    <input
                      id={'rename-' + item.id}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      autoFocus
                    />
                    <button type="button" className="secondary" onClick={commitRename}>
                      Save name
                    </button>
                    <button type="button" className="ghost" onClick={() => setRenamingId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="eval-info">
                    <div>
                      <h2>{item.name}</h2>
                      <p className="hint">
                        {countAnswers(item)} question(s) answered · updated{' '}
                        {new Date(item.updatedAt).toLocaleDateString()}
                        {isActive ? <span className="active-chip"> Active</span> : null}
                      </p>
                    </div>
                    <div className="eval-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => onSelect(item.id)}
                      >
                        {isActive ? 'Open' : 'Select'}
                      </button>
                      <button type="button" className="ghost" onClick={() => onExportSingleJson(item.id)}>
                        Export JSON
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => startRename(item.id, item.name)}
                      >
                        Rename
                      </button>
                      <button type="button" className="ghost" onClick={() => onDuplicate(item.id)}>
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => deleteRow(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}