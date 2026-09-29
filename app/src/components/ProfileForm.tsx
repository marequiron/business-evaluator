import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Profile } from '../types'
import { PROFILE_FIELDS } from '../lib/profileFields'
import { formatMoney, parseMoney } from '../lib/money'
import { validateProfile } from '../lib/validation'

interface Props {
  profile: Profile
  businessName: string
  onChange: (profile: Profile) => void
  onNext: () => void
  onBack: () => void
}

export function ProfileForm({ profile, businessName, onChange, onNext, onBack }: Props) {
  const [attempted, setAttempted] = useState(false)
  const validation = validateProfile(profile)

  function updateField(field: keyof Profile, value: string): void {
    onChange({ ...profile, [field]: value })
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    setAttempted(true)
    if (validation.valid) {
      onNext()
    }
  }

  return (
    <section aria-labelledby="profile-title">
      <div className="page-head">
        <div>
          <p className="kicker">Step 1 of 3</p>
          <h1 id="profile-title">Your business profile</h1>
          <p className="muted">
            {businessName ? (
              <>Evaluating: <strong>{businessName}</strong></>
            ) : (
              'Tell us a little about the idea you are evaluating. This personalises your results and action plan.'
            )}
          </p>
        </div>
      </div>

      <form className="card profile-form" onSubmit={handleSubmit} noValidate>
        {PROFILE_FIELDS.map((field) => {
          const error = validation.errors[field.key]
          const id = 'field-' + field.key
          const errorId = id + '-error'
          const helpId = id + '-help'
          const ariaInvalid = attempted && error ? true : undefined

          if (field.type === 'textarea') {
            return (
              <div className="field" key={field.key}>
                <label htmlFor={id}>{field.label}</label>
                {field.help ? (
                  <p className="hint" id={helpId}>
                    {field.help}
                  </p>
                ) : null}
                <textarea
                  id={id}
                  value={profile[field.key]}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  rows={3}
                  placeholder={field.placeholder}
                  aria-invalid={ariaInvalid}
                  aria-describedby={field.help ? helpId + (error ? ' ' + errorId : '') : error ? errorId : undefined}
                />
                {attempted && error ? (
                  <p className="field-error" id={errorId} role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            )
          }

          const isCost = field.type === 'cost'
          return (
            <div className="field" key={field.key}>
              <label htmlFor={id}>{field.label}</label>
              {field.help ? (
                <p className="hint" id={helpId}>
                  {field.help}
                </p>
              ) : null}
              <input
                id={id}
                type={isCost ? 'text' : 'text'}
                inputMode={isCost ? 'decimal' : undefined}
                value={profile[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                aria-invalid={ariaInvalid}
                aria-describedby={field.help ? helpId + (error ? ' ' + errorId : '') : error ? errorId : undefined}
              />
              {attempted && error ? (
                <p className="field-error" id={errorId} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          )
        })}

        {attempted && !validation.valid ? (
          <p className="form-summary-error" role="alert">
            Please fix the highlighted fields before continuing.
          </p>
        ) : null}

        <CostSummary cost={parseMoney(profile.startupCost)} />

        <div className="form-actions">
          <button type="button" className="secondary" onClick={onBack}>
            Back
          </button>
          <button type="submit" className="primary">
            Continue to Evaluation
          </button>
        </div>
      </form>
    </section>
  )
}

function CostSummary({ cost }: { cost: number | null }) {
  if (cost == null) return null
  return (
    <p className="hint">
      Startup cost entered: {formatMoney(cost)}
    </p>
  )
}