import { useState } from 'react'
import Icon from './Icon.jsx'
import Dual from './Dual.jsx'
import { t } from '../lib/text.js'

function PosterFigure({ src, caption, title }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="poster-missing">
        <Icon name="camera" size={16} />
        <span>Image not found: {src}</span>
      </div>
    )
  }

  return (
    <figure className="poster-figure">
      <img
        src={src}
        alt={t(caption) || `Original student project poster: ${title}`}
        onError={() => setFailed(true)}
        loading="lazy"
      />
      {caption ? <figcaption><Dual v={caption} /></figcaption> : null}
    </figure>
  )
}

export default function PosterSection({ poster, posters, title, sourceKind }) {
  if (posters?.length) {
    return (
      <div className="poster-gallery">
        {posters.map((item) => (
          <PosterFigure key={item.src} src={item.src} caption={item.caption} title={title} />
        ))}
        <p className="poster-gallery-note">
          <Icon name="flag" size={14} />
          {sourceKind === 'fictional_demo'
            ? 'Fictional demo image created for this prototype — not a real student submission.'
            : sourceKind === 'student_submission'
              ? 'Images shared by the student team as part of this published field study.'
              : `All ${posters.length} images are unmodified student originals from the “Go Far — outcome display examples” PDF.`}
        </p>
      </div>
    )
  }

  return (
    <div className="poster-drop">
      <div className="poster-frame" aria-hidden="true">
        <span className="poster-frame-inner">{title}</span>
      </div>
      <div className="poster-drop-copy">
        <p className="poster-drop-title">
          <Icon name="camera" size={16} /> Original poster scan not added yet
        </p>
        <p>{t(poster?.note) || 'Image-based posters are the primary historical record.'}</p>
        <code className="path-code">{poster?.imagePath || '/posters/<case-id>.png'}</code>
        <p className="muted small">
          Save the scan at <code className="path-code">public{poster?.imagePath || ''}</code> and reload — it
          renders here full-resolution, no code change needed.
        </p>
      </div>
    </div>
  )
}
