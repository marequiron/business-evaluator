import { useInstallPrompt } from '../hooks/useInstallPrompt'

interface Props {
  hasSaved: boolean
  hasActive: boolean
  onStart: () => void
  onContinue: () => void
  onLoadSample: () => void
  onPresentation: () => void
}

export function WelcomeScreen({ hasSaved, hasActive, onStart, onContinue, onLoadSample, onPresentation }: Props) {
  const { canInstall, installed, install } = useInstallPrompt()

  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <div className="hero">
        <p className="kicker">Business Evaluator</p>
        <h1 id="welcome-title">Test your business idea before you risk your savings.</h1>
        <p className="hero-copy">
          Answer a guided set of plain-language questions across ten key areas. See your
          category scores, your overall readiness, your real risks, and a personalised
          short-term and long-term action plan. Everything runs in your browser and stays on
          your device.
        </p>
      </div>

      <div className="welcome-actions" role="group" aria-label="Start options">
        <div className="action-card action-primary">
          <h2>Start a new evaluation</h2>
          <p>Answer ten short, guided sets of questions about your business idea.</p>
          <button type="button" className="primary" onClick={onStart}>
            Start Evaluation
          </button>
        </div>

        <div className="action-card">
          <h2>Pick up where you left off</h2>
          <p>Your evaluations are saved automatically as you type.</p>
          <button type="button" className="secondary" onClick={onContinue} disabled={!hasSaved}>
            Continue Saved Evaluation
          </button>
          {!hasSaved ? (
            <p className="hint">No saved evaluations yet on this device.</p>
          ) : (
            <p className="hint">Open the evaluation manager to choose one.</p>
          )}
        </div>

        <div className="action-card">
          <h2>Explore a realistic example</h2>
          <p>
            Load a clearly-labelled sample business with real strengths, weaknesses, and risks
            so you can see a full evaluation in seconds.
          </p>
          <button type="button" className="secondary" onClick={onLoadSample}>
            Load Sample Idea
          </button>
        </div>

        <div className="action-card">
          <h2>Present to an audience</h2>
          <p>Full-screen summary slides you can move through at your own pace.</p>
          <button type="button" className="secondary" onClick={onPresentation} disabled={!hasActive}>
            Presentation Mode
          </button>
          {!hasActive ? <p className="hint">Start or load an evaluation first.</p> : null}
        </div>
      </div>

      <aside className="privacy-note" aria-label="Privacy note">
        <p>
          <strong>By default, nothing leaves this device.</strong> No account, no server, no
          tracking. Your data is stored in this browser only. Export a JSON backup or CSV from
          the evaluation manager at any time.
        </p>
      </aside>

      {canInstall ? (
        <aside className="install-banner" aria-label="Install app">
          <p className="install-banner-text">
            <strong>Install Business Evaluator</strong> on this device. It runs offline and your
            data stays here.
          </p>
          <button type="button" className="primary" onClick={() => void install()}>
            Install app
          </button>
        </aside>
      ) : null}
      {installed ? (
        <p className="hint install-banner-text">
          Business Evaluator has been installed on this device.
        </p>
      ) : null}
    </section>
  )
}