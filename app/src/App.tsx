import { useCallback, useMemo, useState } from 'react'
import type { Answers, Evaluation, Profile, View } from './types'
import {
  browserStorage,
  deleteEvaluation,
  duplicateEvaluation,
  findById,
  loadAll,
  newEvaluation,
  renameEvaluation,
  upsertEvaluation,
} from './lib/storage'
import { createSampleEvaluation } from './lib/sample'
import { computeScore } from './lib/scoring'
import { buildReport } from './lib/recommendations'
import {
  downloadTextFile,
  evaluationToJson,
  evaluationsToCsv,
  evaluationsToJson,
  importEvaluations,
  parseEvaluationsJson,
} from './lib/io'
import { ErrorBoundary } from './components/ErrorBoundary'
import { WelcomeScreen } from './components/WelcomeScreen'
import { ProfileForm } from './components/ProfileForm'
import { Wizard } from './components/Wizard'
import { ResultsDashboard } from './components/ResultsDashboard'
import { PresentationMode } from './components/PresentationMode'
import { EvaluationManager } from './components/EvaluationManager'

export default function App() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>(() => loadAll(browserStorage))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<View>('welcome')

  const active = useMemo(() => findById(evaluations, activeId), [evaluations, activeId])

  const activeScore = useMemo(
    () => (active ? computeScore(active.answers) : null),
    [active],
  )
  const activeReport = useMemo(
    () => (active && activeScore ? buildReport(active, activeScore) : null),
    [active, activeScore],
  )

  const hasSaved = evaluations.length > 0
  const hasActive = Boolean(active)

  const startEvaluation = useCallback(() => {
    const created = newEvaluation('My evaluation')
    setEvaluations((prev) => upsertEvaluation(prev, created))
    setActiveId(created.id)
    setView('profile')
  }, [])

  const loadSample = useCallback(() => {
    const sample = createSampleEvaluation()
    setEvaluations((prev) => upsertEvaluation(prev, sample))
    setActiveId(sample.id)
    setView('results')
  }, [])

  const updateActiveProfile = useCallback(
    (profile: Profile) => {
      if (!active) return
      const next: Evaluation = { ...active, profile }
      setEvaluations((prev) => upsertEvaluation(prev, next))
    },
    [active],
  )

  const updateActiveAnswers = useCallback(
    (answers: Answers) => {
      if (!active) return
      const next: Evaluation = { ...active, answers }
      setEvaluations((prev) => upsertEvaluation(prev, next))
    },
    [active],
  )

  const selectEvaluation = useCallback((id: string) => {
    setActiveId(id)
    const item = findById(evaluations, id)
    const answered = item
      ? Object.values(item.answers).filter((a) => typeof a.value === 'number').length
      : 0
    setView(answered > 0 ? 'results' : 'profile')
  }, [evaluations])

  const handleDelete = useCallback((id: string) => {
    setEvaluations((prev) => {
      const next = deleteEvaluation(prev, id)
      if (!next.some((e) => e.id === activeId)) {
        setActiveId(null)
      }
      return next
    })
  }, [activeId])

  const handleRename = useCallback(
    (id: string, name: string) => {
      setEvaluations((prev) => renameEvaluation(prev, id, name))
    },
    [],
  )

  const handleDuplicate = useCallback((id: string) => {
    setEvaluations((prev) => duplicateEvaluation(prev, id))
  }, [])

  const handleImport = useCallback((text: string): number | null => {
    const incoming = parseEvaluationsJson(text)
    setEvaluations((prev) => importEvaluations(prev, incoming))
    return incoming.length
  }, [])

  const handleExportAllJson = useCallback(() => {
    downloadTextFile('business-evaluations.json', evaluationsToJson(evaluations), 'application/json')
  }, [evaluations])

  const handleExportSingleJson = useCallback((id: string) => {
    const item = findById(evaluations, id)
    if (!item) return
    downloadTextFile(safeFileName(item.name) + '.json', evaluationToJson(item), 'application/json')
  }, [evaluations])

  const handleExportAllCsv = useCallback(() => {
    const scores: Record<string, ReturnType<typeof computeScore>> = {}
    for (const item of evaluations) {
      scores[item.id] = computeScore(item.answers)
    }
    downloadTextFile('business-evaluations.csv', evaluationsToCsv(evaluations, scores), 'text/csv')
  }, [evaluations])

  const handleExportActiveCsv = useCallback(() => {
    if (!active) return
    const scores: Record<string, ReturnType<typeof computeScore>> = { [active.id]: computeScore(active.answers) }
    downloadTextFile(safeFileName(active.name) + '-results.csv', evaluationsToCsv([active], scores), 'text/csv')
  }, [active])

  function renderView(): React.ReactNode {
    switch (view) {
      case 'profile': {
        if (!active) {
          return <NoActiveEvaluation onHome={() => setView('welcome')} />
        }
        return (
          <ProfileForm
            profile={active.profile}
            businessName={active.name}
            onChange={updateActiveProfile}
            onNext={() => setView('wizard')}
            onBack={() => setView('welcome')}
          />
        )
      }
      case 'wizard': {
        if (!active || !activeScore) {
          return <NoActiveEvaluation onHome={() => setView('welcome')} />
        }
        return (
          <Wizard
            evaluation={active}
            onAnswersChange={updateActiveAnswers}
            onBack={() => setView('profile')}
            onFinish={() => setView('results')}
          />
        )
      }
      case 'results': {
        if (!active || !activeScore || !activeReport) {
          return <NoActiveEvaluation onHome={() => setView('welcome')} />
        }
        return (
          <ResultsDashboard
            evaluation={active}
            score={activeScore}
            report={activeReport}
            onBack={() => setView('manager')}
            onPresentation={() => setView('presentation')}
            onEditAnswers={() => setView('wizard')}
            onExportCsv={handleExportActiveCsv}
          />
        )
      }
      case 'presentation': {
        if (!active || !activeScore || !activeReport) {
          return <NoActiveEvaluation onHome={() => setView('welcome')} />
        }
        return (
          <PresentationMode
            evaluation={active}
            score={activeScore}
            report={activeReport}
            onExit={() => setView('results')}
          />
        )
      }
      case 'manager':
        return (
          <EvaluationManager
            evaluations={evaluations}
            activeId={activeId}
            onSelect={selectEvaluation}
            onCreate={() => {
              const created = newEvaluation('My evaluation')
              setEvaluations((prev) => upsertEvaluation(prev, created))
              setActiveId(created.id)
              setView('profile')
            }}
            onRename={handleRename}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onImport={handleImport}
            onExportJson={handleExportAllJson}
            onExportCsv={handleExportAllCsv}
            onExportSingleJson={handleExportSingleJson}
            onPrint={() => window.print()}
            onHome={() => setView('welcome')}
          />
        )
      case 'welcome':
        return (
          <WelcomeScreen
            hasSaved={hasSaved}
            hasActive={hasActive}
            onStart={startEvaluation}
            onContinue={() => setView('manager')}
            onLoadSample={loadSample}
            onPresentation={() => setView(activeId ? 'presentation' : 'manager')}
          />
        )
    }
  }

  return (
    <ErrorBoundary>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            BE
          </span>
          <span className="brand-name">Business Evaluator</span>
        </div>
        <nav className="app-nav" aria-label="Primary">
          <button type="button" className="nav-link" onClick={() => setView('welcome')}>
            Home
          </button>
          <button type="button" className="nav-link" onClick={() => setView('manager')}>
            My evaluations
          </button>
          {active ? (
            <span className="nav-active" title="Active evaluation">
              {active.name}
            </span>
          ) : null}
        </nav>
      </header>
      <main id="main" className="content">
        {renderView()}
      </main>
      {view !== 'presentation' ? (
        <footer className="app-footer">
          <p>
            Runs entirely in your browser. Your answers never leave this device, and no account or
            internet connection is required after install.
          </p>
        </footer>
      ) : null}
    </ErrorBoundary>
  )
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_ ]/gu, '').replace(/\s+/gu, '-').slice(0, 60) || 'business-evaluation'
}

function NoActiveEvaluation({ onHome }: { onHome: () => void }) {
  return (
    <section className="card empty-state" aria-labelledby="none-title">
      <h1 id="none-title">No evaluation selected</h1>
      <p>Start a new evaluation, load the sample, or open one from My evaluations.</p>
      <button type="button" className="primary" onClick={onHome}>
        Back to Home
      </button>
    </section>
  )
}