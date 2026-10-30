import { Link, useParams } from 'react-router-dom'
import { useAppState } from '../lib/AppState.jsx'
import { STATUS_META } from '../data/seedCases.js'
import { canViewCase, visibleEntriesForCase, isTeam } from '../lib/visibility.js'
import { StatusBadge, StatusStepper, SourceBadge } from '../components/badges.jsx'
import PosterSection from '../components/PosterSection.jsx'
import EntryCard from '../components/EntryCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import Dual from '../components/Dual.jsx'
import { t } from '../lib/text.js'

export default function CaseDetail() {
  const { id } = useParams()
  const { cases, role, entries, updateEntry, deleteEntry, remoteLoading } = useAppState()
  const kase = cases.find((c) => c.id === id)

  if (!kase && remoteLoading) {
    return <div className="page page-detail"><EmptyState icon="search" title="Loading case…" /></div>
  }

  if (!kase) {
    return (
      <div className="page">
        <EmptyState icon="search" title="Case not found" action={<Link className="btn btn-primary" to="/cases">Back to the library</Link>}>
          <p>It may have been reset with the demo data.</p>
        </EmptyState>
      </div>
    )
  }

  if (!canViewCase(role, kase)) {
    return (
      <div className="page">
        <EmptyState
          icon="lock"
          title="This case is not public yet"
          action={<Link className="btn btn-primary" to="/cases">Browse published cases</Link>}
        >
          <p>
            <strong>{kase.titleEn || kase.title}</strong> is an <em>{STATUS_META[kase.status].label.toLowerCase()}</em>.
            Public Visitors can only open published cases. Switch to the Student view to view and edit it.
          </p>
        </EmptyState>
      </div>
    )
  }

  const entriesAll = kase.entries || entries.filter((entry) => entry.caseId === kase.id)
  const shown = kase.entries || visibleEntriesForCase(role, entries, kase)
  const hiddenTeamCount = entriesAll.length - shown.length
  const displayTitle = kase.titleEn || kase.title

  return (
    <div className="page page-detail">
      <Link to="/cases" className="back-link">
        <Icon name="arrow" size={15} className="flip" /> All cases
      </Link>

      <header className="detail-head">
        <div className="detail-head-main">
          <div className="case-card-top">
            <StatusBadge status={kase.status} size="md" />
            <SourceBadge source={kase.source} full />
          </div>
          <h1 className="detail-title">{displayTitle}</h1>
          <Dual v={kase.summary} className="detail-summary" />
          <ul className="chip-row">
            {kase.themes.map((theme) => (
              <li key={theme} className="chip chip-lg">{theme}</li>
            ))}
            {(kase.subjects || []).map((subject) => (
              <li key={t(subject)} className="chip chip-lg chip-subject">{t(subject)}</li>
            ))}
          </ul>
          {kase.meta ? (
            <dl className="case-meta">
              {[
                ['Program', kase.meta.program],
                ['Location', kase.meta.location],
                ['Team', kase.meta.team],
                ['When', kase.meta.period],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label} className="case-meta-item">
                    <dt>{label}</dt>
                    <dd>{t(value)}</dd>
                  </div>
                ))}
            </dl>
          ) : null}
        </div>

        <aside className="detail-side">
          <div className="panel">
            <h2 className="panel-title">Publication</h2>
            <StatusStepper status={kase.status} />
            <p className="muted small">
              {kase.status === 'published'
                ? 'Published: visible to Public Visitors.'
                : 'In progress. Students only.'}
            </p>
          </div>

          <div className="panel panel-provenance">
            <h2 className="panel-title">
              <Icon name="flag" size={15} /> Where this comes from
            </h2>
            <p className="small">{kase.source.provenance}</p>
          </div>
        </aside>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="section" id="questions">
            <h2 className="section-title">
              <Icon name="question" size={18} /> Research questions
            </h2>
            {kase.researchQuestions?.length ? (
              <ol className="question-list">
                {kase.researchQuestions.map((question, index) => (
                  <li key={index}>
                    <span className="q-num" aria-hidden="true">{index + 1}</span>
                    <p>
                      {question.topic ? <Dual v={question.topic} className="q-topic" original={false} /> : null}
                      <Dual v={question.text} />
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon="question" title="No research question recorded">
                <p>The original poster did not state one, and the prototype does not invent one.</p>
              </EmptyState>
            )}
          </section>

          <section className="section" id="methods">
            <h2 className="section-title">
              <Icon name="filter" size={18} /> Research methods
            </h2>
            {kase.methods?.length ? (
              <ul className="method-list">
                {kase.methods.map((method, index) => (
                  <li key={index} className="method-item">
                    <Icon name="check" size={14} />
                    <Dual v={method} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="note" title="No methods recorded" />
            )}
          </section>

          <section className="section" id="journey">
            <h2 className="section-title">
              <Icon name="clock" size={18} /> Learning journey
            </h2>
            <p className="section-note">In the order it happened, from preparation to reflection.</p>
            {kase.journey?.length ? (
              <ol className="journey">
                {kase.journey.map((step, index) => (
                  <li key={step.id} className="journey-item">
                    <span className="journey-marker" aria-hidden="true">{index + 1}</span>
                    <div className="journey-body">
                      <Dual v={step.phase} className="journey-phase" original={false} />
                      <Dual v={step.title} className="journey-title" original={false} />
                      <Dual v={step.description} className="journey-desc" />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon="clock" title="No journey entries yet">
                <p>Capture the trip as it happens in the student workspace on the homepage.</p>
              </EmptyState>
            )}
          </section>

          {kase.craftSteps?.length ? (
            <section className="section" id="craft">
              <h2 className="section-title">
                <Icon name="spark" size={18} /> The making process
              </h2>
              <p className="section-note">The four embroidery steps documented on the poster.</p>
              <ol className="craft">
                {kase.craftSteps.map((step, index) => (
                  <li key={step.id} className="craft-card">
                    <span className="craft-num">Step {index + 1}</span>
                    <h3 className="craft-zh">{step.labelEn}</h3>
                    <Dual v={step.description} className="craft-desc" />
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {kase.interview ? (
            <section className="section" id="interview">
              <h2 className="section-title">
                <Icon name="note" size={18} /> {t(kase.interview.title)}
              </h2>
              <p className="section-note">{t(kase.interview.date)} · Participant names are preserved in the original poster.</p>
              <div className="interview">
                {kase.interview.topics.map((topic) => (
                  <div key={t(topic.name)} className="interview-topic">
                    <Dual v={topic.name} className="interview-topic-name" original={false} />
                    <dl className="qa-list">
                      {topic.qa.map((item, index) => (
                        <div key={index} className="qa">
                          <dt className="qa-q">
                            <span className="qa-mark" aria-hidden="true">Q</span>
                            <Dual v={item.q} />
                          </dt>
                          <dd className="qa-a">
                            <span className="qa-mark qa-mark-a" aria-hidden="true">A</span>
                            <Dual v={item.a} />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
              {kase.interview.note ? <p className="muted small">{t(kase.interview.note)}</p> : null}
            </section>
          ) : null}

          <section className="section" id="outcomes">
            <h2 className="section-title">
              <Icon name="check" size={18} /> Final outcomes
            </h2>
            <div className="two-col">
              <div>
                <h3 className="sub-title">Conclusions</h3>
                {kase.outcomes?.conclusions?.length ? (
                  <ul className="bullet-list">
                    {kase.outcomes.conclusions.map((conclusion, index) => (
                      <li key={index}><Dual v={conclusion} /></li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Not written up yet.</p>
                )}
              </div>
              <div>
                <h3 className="sub-title">Produced</h3>
                {kase.outcomes?.artifacts?.length ? (
                  <ul className="bullet-list bullet-artifact">
                    {kase.outcomes.artifacts.map((artifact, index) => (
                      <li key={index}><Dual v={artifact} /></li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Nothing recorded.</p>
                )}
              </div>
            </div>
            {kase.attachments?.length ? (
              <div className="case-attachments">
                <h3 className="sub-title">Project files</h3>
                {kase.attachments.map((attachment) => (
                  <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer">
                    {attachment.label} <Icon name="arrow" size={14} />
                  </a>
                ))}
              </div>
            ) : null}
          </section>

          <section className="section" id="impact">
            <h2 className="section-title">
              <Icon name="eye" size={18} /> Project Learning &amp; Value
            </h2>
            <Dual v={kase.impactReflection?.summary} className="reflection-lead" />
            {kase.impactReflection?.reflections?.length ? (
              <ul className="quote-list">
                {kase.impactReflection.reflections.map((reflection, index) => (
                  <li key={index}><Dual v={reflection} /></li>
                ))}
              </ul>
            ) : null}
            {kase.impactReflection?.openQuestions?.length ? (
              <div className="open-questions">
                <h3 className="sub-title">Still open</h3>
                <ul className="bullet-list">
                  {kase.impactReflection.openQuestions.map((question, index) => (
                    <li key={index}><Dual v={question} /></li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="section" id="poster">
            <h2 className="section-title">
              <Icon name="camera" size={18} /> {kase.source.kind === 'poster_sample' ? 'Original posters' : 'Project images'}
            </h2>
            <PosterSection poster={kase.poster} posters={kase.posters} title={displayTitle} sourceKind={kase.source.kind} />
          </section>

          <section className="section" id="journal">
            <h2 className="section-title">
              <Icon name="note" size={18} /> {kase.status === 'published' ? 'Journal from this project' : 'Learning journal'}
            </h2>
            {shown.length > 0 ? (
              <>
                <ul className="entry-list">
                  {shown.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      role={role}
                      onToggleVisibility={(entryToUpdate) =>
                        updateEntry(entryToUpdate.id, { visibility: entryToUpdate.visibility === 'team' ? 'public' : 'team' })
                      }
                      onDelete={(entryToDelete) => deleteEntry(entryToDelete.id)}
                    />
                  ))}
                </ul>
                {isTeam(role) && hiddenTeamCount > 0 ? (
                  <p className="results-note">
                    <Icon name="lock" size={14} /> {hiddenTeamCount} team-only {hiddenTeamCount === 1 ? 'entry is' : 'entries are'} hidden from Public Visitors.
                  </p>
                ) : null}
              </>
            ) : (
              <EmptyState icon="note" title={isTeam(role) ? 'Nothing journaled on this case yet' : 'No public journal entries'}>
                <p>
                  {isTeam(role)
                    ? 'Open My field study on the homepage to journal and publish your own project.'
                    : 'The team has not shared any journal entries for this case yet.'}
                </p>
              </EmptyState>
            )}

          </section>
        </div>

        <nav className="detail-toc" aria-label="Case sections">
          <h2 className="panel-title">On this page</h2>
          <ol className="toc">
            <li><a href="#questions">Research questions</a></li>
            <li><a href="#methods">Research methods</a></li>
            <li><a href="#journey">Learning journey</a></li>
            {kase.craftSteps?.length ? <li><a href="#craft">Making process</a></li> : null}
            {kase.interview ? <li><a href="#interview">Interview record</a></li> : null}
            <li><a href="#outcomes">Final outcomes</a></li>
            <li><a href="#impact">Project Learning &amp; Value</a></li>
            <li><a href="#poster">{kase.source.kind === 'fictional_demo' ? 'Project image' : 'Original posters'}</a></li>
            <li><a href="#journal">Journal</a></li>
          </ol>
        </nav>
      </div>
    </div>
  )
}
