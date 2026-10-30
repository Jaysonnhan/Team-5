import { useState } from 'react'
import Icon from './Icon.jsx'
import Dual from './Dual.jsx'
import { l, t } from '../lib/text.js'

function PosterFigure({ src, caption, title }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="poster-missing">
        <Icon name="camera" size={16} />
        <span>{l('Image not found', '未找到图片')}: {src}</span>
      </div>
    )
  }

  return (
    <figure className="poster-figure">
      <img
        src={src}
        alt={t(caption) || l(`Original student project poster: ${title}`, `学生原始项目海报：${title}`)}
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
            ? l('Fictional demo image created for this prototype — not a real student submission.', '为本原型制作的虚构演示图片，并非真实学生作品。')
            : sourceKind === 'student_submission'
              ? l('Images shared by the student team as part of this published field study.', '由学生小队随这项已发布研究分享的图片。')
              : l(
                  `${posters.length} student-made poster ${posters.length === 1 ? 'image' : 'images'}, shown unmodified.`,
                  `${posters.length} 张学生原创海报，原样展示。`,
                )}
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
          <Icon name="camera" size={16} /> {l('Original poster scan not added yet', '尚未添加原始海报扫描件')}
        </p>
        <p>{t(poster?.note) || l('Image-based posters are the primary historical record.', '图像海报是最主要的一手记录。')}</p>
        <code className="path-code">{poster?.imagePath || '/posters/<case-id>.png'}</code>
        <p className="muted small">
          {l('Save the scan at', '将扫描件保存到')} <code className="path-code">public{poster?.imagePath || ''}</code>{' '}
          {l('and reload — it renders here full-resolution, no code change needed.', '并刷新页面，即可全分辨率显示，无需修改代码。')}
        </p>
      </div>
    </div>
  )
}
