import { Link, useParams } from 'react-router-dom'
import { useAppState } from '../lib/AppState.jsx'
import { useLang } from '../lib/i18n.jsx'
import { canViewCase, visibleEntriesForCase, isTeam } from '../lib/visibility.js'
import { StatusBadge, StatusStepper, SourceBadge } from '../components/badges.jsx'
import PosterSection from '../components/PosterSection.jsx'
import EntryCard from '../components/EntryCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import Dual from '../components/Dual.jsx'
import { caseTitle, l, t, themeLabel } from '../lib/text.js'

export default function CaseDetail() {
  const { id } = useParams()
  const { lang } = useLang()
  const { cases, role, entries, updateEntry, deleteEntry, remoteLoading } = useAppState()
  const kase = cases.find((c) => c.id === id)

  if (!kase && remoteLoading) {
    return <div className="page page-detail"><EmptyState icon="search" title={l('Loading case…', '正在加载案例…')} /></div>
  }

  if (!kase) {
    return (
      <div className="page">
        <EmptyState
          icon="search"
          title={l('Case not found', '未找到该案例')}
          action={<Link className="btn btn-primary" to="/cases">{l('Back to the library', '返回案例库')}</Link>}
        >
          <p>{l('It may have been reset with the demo data.', '它可能已被演示数据重置。')}</p>
        </EmptyState>
      </div>
    )
  }

  if (!canViewCase(role, kase)) {
    return (
      <div className="page">
        <EmptyState
          icon="lock"
          title={l('This case is not public yet', '该案例尚未公开')}
          action={<Link className="btn btn-primary" to="/cases">{l('Browse published cases', '浏览已发布案例')}</Link>}
        >
          <p>
            {l(
              'This field study is still in progress. Public Visitors can only open published cases. Switch to the Student view to view and edit it.',
              '这项田野研究仍在进行中。公众访客只能打开已发布的案例，切换到学生视图即可查看和编辑。',
            )}
          </p>
        </EmptyState>
      </div>
    )
  }

  const entriesAll = kase.entries || entries.filter((entry) => entry.caseId === kase.id)
  const shown = kase.entries || visibleEntriesForCase(role, entries, kase)
  const hiddenTeamCount = entriesAll.length - shown.length
  const displayTitle = caseTitle(kase)
  const isPosterCase = kase.source.kind === 'poster_sample'

  return (
    <div className="page page-detail">
      <Link to="/cases" className="back-link">
        <Icon name="arrow" size={15} className="flip" /> {l('All cases', '所有案例')}
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
              <li key={theme} className="chip chip-lg">{themeLabel(theme)}</li>
            ))}
            {(kase.subjects || []).map((subject) => (
              <li key={t(subject)} className="chip chip-lg chip-subject">{t(subject)}</li>
            ))}
          </ul>
          {kase.meta ? (
            <dl className="case-meta">
              {[
                [l('Program', '项目'), kase.meta.program],
                [l('Location', '地点'), kase.meta.location],
                [l('Team', '小队'), kase.meta.team],
                [l('When', '时间'), kase.meta.period],
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
            <h2 className="panel-title">{l('Publication', '发布状态')}</h2>
            <StatusStepper status={kase.status} />
            <p className="muted small">
              {kase.status === 'published'
                ? l('Published: visible to Public Visitors.', '已发布：公众访客可见。')
                : l('In progress. Students only.', '进行中：仅学生可见。')}
            </p>
          </div>

          <div className="panel panel-provenance">
            <h2 className="panel-title">
              <Icon name="flag" size={15} /> {l('Where this comes from', '案例来源')}
            </h2>
            <p className="small">{t(kase.source.provenance)}</p>
          </div>
        </aside>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="section" id="questions">
            <h2 className="section-title">
              <Icon name="question" size={18} /> {l('Research questions', '研究问题')}
            </h2>
            {kase.researchQuestions?.length ? (
              <ol className="question-list">
                {kase.researchQuestions.map((question, index) => (
                  <li key={index}>
                    <span className="q-num" aria-hidden="true">{index + 1}</span>
                    <p>
                      {question.topic ? <Dual v={question.topic} className="q-topic" /> : null}
                      <Dual v={question.text} />
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon="question" title={l('No research question recorded', '未记录研究问题')}>
                <p>{l('The original poster did not state one, and the prototype does not invent one.', '原始海报没有提出研究问题，原型也不做虚构补充。')}</p>
              </EmptyState>
            )}
          </section>

          <section className="section" id="methods">
            <h2 className="section-title">
              <Icon name="filter" size={18} /> {l('Research methods', '研究方法')}
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
              <EmptyState icon="note" title={l('No methods recorded', '未记录研究方法')} />
            )}
          </section>

          <section className="section" id="journey">
            <h2 className="section-title">
              <Icon name="clock" size={18} /> {l('Learning journey', '研学过程')}
            </h2>
            <p className="section-note">{l('In the order it happened, from preparation to reflection.', '按发生顺序，从准备到反思。')}</p>
            {kase.journey?.length ? (
              <ol className="journey">
                {kase.journey.map((step, index) => (
                  <li key={step.id} className="journey-item">
                    <span className="journey-marker" aria-hidden="true">{index + 1}</span>
                    <div className="journey-body">
                      <Dual v={step.phase} className="journey-phase" />
                      <Dual v={step.title} className="journey-title" />
                      <Dual v={step.description} className="journey-desc" />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon="clock" title={l('No journey entries yet', '还没有过程记录')}>
                <p>{l('Capture the trip as it happens in the student workspace on the homepage.', '在首页的学生创作台随时记录研究过程。')}</p>
              </EmptyState>
            )}
          </section>

          {kase.craftSteps?.length ? (
            <section className="section" id="craft">
              <h2 className="section-title">
                <Icon name="spark" size={18} /> {l('The making process', '制作过程')}
              </h2>
              <p className="section-note">{l('Making steps documented on the student poster.', '制作步骤记录自学生海报。')}</p>
              <ol className="craft">
                {kase.craftSteps.map((step, index) => (
                  <li key={step.id} className="craft-card">
                    <span className="craft-num">{l('Step', '第')} {index + 1}{lang === 'zh' ? ' 步' : ''}</span>
                    <h3 className="craft-zh">{lang === 'zh' ? step.labelZh || step.labelEn : step.labelEn || step.labelZh}</h3>
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
              <p className="section-note">
                {t(kase.interview.date)} · {l('Participant names are preserved in the original poster.', '参与者姓名沿用原始海报。')}
              </p>
              <div className="interview">
                {kase.interview.topics.map((topic) => (
                  <div key={t(topic.name)} className="interview-topic">
                    <Dual v={topic.name} className="interview-topic-name" />
                    <dl className="qa-list">
                      {topic.qa.map((item, index) => (
                        <div key={index} className="qa">
                          <dt className="qa-q">
                            <span className="qa-mark" aria-hidden="true">{l('Q', '问')}</span>
                            <Dual v={item.q} />
                          </dt>
                          <dd className="qa-a">
                            <span className="qa-mark qa-mark-a" aria-hidden="true">{l('A', '答')}</span>
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
              <Icon name="check" size={18} /> {l('Final outcomes', '最终成果')}
            </h2>
            <div className="two-col">
              <div>
                <h3 className="sub-title">{l('Conclusions', '研究结论')}</h3>
                {kase.outcomes?.conclusions?.length ? (
                  <ul className="bullet-list">
                    {kase.outcomes.conclusions.map((conclusion, index) => (
                      <li key={index}><Dual v={conclusion} /></li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">{l('Not written up yet.', '尚未整理。')}</p>
                )}
              </div>
              <div>
                <h3 className="sub-title">{l('Produced', '产出物')}</h3>
                {kase.outcomes?.artifacts?.length ? (
                  <ul className="bullet-list bullet-artifact">
                    {kase.outcomes.artifacts.map((artifact, index) => (
                      <li key={index}><Dual v={artifact} /></li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">{l('Nothing recorded.', '暂无记录。')}</p>
                )}
              </div>
            </div>
            {kase.attachments?.length ? (
              <div className="case-attachments">
                <h3 className="sub-title">{l('Project files', '项目文件')}</h3>
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
              <Icon name="eye" size={18} /> {l('Project Learning & Value', '项目收获与价值')}
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
                <h3 className="sub-title">{l('Still open', '仍待探索')}</h3>
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
              <Icon name="camera" size={18} /> {isPosterCase ? l('Original posters', '原始海报') : l('Project images', '项目图片')}
            </h2>
            <PosterSection poster={kase.poster} posters={kase.posters} title={displayTitle} sourceKind={kase.source.kind} />
          </section>

          <section className="section" id="journal">
            <h2 className="section-title">
              <Icon name="note" size={18} />{' '}
              {kase.status === 'published' ? l('Journal from this project', '本项目的研学日志') : l('Learning journal', '研学日志')}
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
                    <Icon name="lock" size={14} />{' '}
                    {l(
                      `${hiddenTeamCount} team-only ${hiddenTeamCount === 1 ? 'entry is' : 'entries are'} hidden from Public Visitors.`,
                      `${hiddenTeamCount} 条仅团队可见的记录未向公众访客展示。`,
                    )}
                  </p>
                ) : null}
              </>
            ) : (
              <EmptyState
                icon="note"
                title={isTeam(role) ? l('Nothing journaled on this case yet', '该案例还没有日志记录') : l('No public journal entries', '暂无公开日志')}
              >
                <p>
                  {isTeam(role)
                    ? l('Open My field study on the homepage to journal and publish your own project.', '在首页打开“我的田野研究”，记录并发布你自己的项目。')
                    : l('The team has not shared any journal entries for this case yet.', '小队还没有为这个案例分享日志记录。')}
                </p>
              </EmptyState>
            )}
          </section>
        </div>

        <nav className="detail-toc" aria-label={l('Case sections', '案例目录')}>
          <h2 className="panel-title">{l('On this page', '本页目录')}</h2>
          <ol className="toc">
            <li><a href="#questions">{l('Research questions', '研究问题')}</a></li>
            <li><a href="#methods">{l('Research methods', '研究方法')}</a></li>
            <li><a href="#journey">{l('Learning journey', '研学过程')}</a></li>
            {kase.craftSteps?.length ? <li><a href="#craft">{l('Making process', '制作过程')}</a></li> : null}
            {kase.interview ? <li><a href="#interview">{l('Interview record', '访谈记录')}</a></li> : null}
            <li><a href="#outcomes">{l('Final outcomes', '最终成果')}</a></li>
            <li><a href="#impact">{l('Project Learning & Value', '项目收获与价值')}</a></li>
            <li><a href="#poster">{isPosterCase ? l('Original posters', '原始海报') : l('Project image', '项目图片')}</a></li>
            <li><a href="#journal">{l('Journal', '研学日志')}</a></li>
          </ol>
        </nav>
      </div>
    </div>
  )
}
