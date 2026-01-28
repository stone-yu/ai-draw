import {DocLayout} from '@/components/layout/DocLayout'
import {Github, MessageSquare} from 'lucide-react'
import {SimpleMarkdown} from '@/components/ui/SimpleMarkdown'
import {Button} from '@/components/ui'
import {useSystemStore} from '@/stores/systemStore'

const FAQ_DATA = {
  zh: [
    {
      question: '本地模式的数据安全吗？',
      answer: `非常安全。在本地模式下，您的所有数据都存储在浏览器的 **IndexedDB** 中，不会上传到任何服务器。`
    }
  ],
  en: [
    {
      question: 'Is local mode data secure?',
      answer: `Very secure. In local mode, all your data is stored in the browser's **IndexedDB** and is never uploaded to any server.`
    }
  ]
}

export function FeedbackPage() {
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)

  const content = {
    zh: {
      intro: '您的反馈对我们非常重要。如果您在使用过程中遇到任何问题，或者有任何功能建议，欢迎通过以下方式联系我们。',
      onlineContact: '在线联系',
      onlineContactDesc: '联系作者进群，在线反馈问题。',
      githubIssues: 'Github Issues',
      githubIssuesDesc: '提交 Bug 或功能请求。',
      submitIssue: '提交 Issue',
      faq: '常见问题'
    },
    en: {
      intro: 'Your feedback is very important to us. If you encounter any problems or have feature suggestions, please contact us through the following methods.',
      onlineContact: 'Online Contact',
      onlineContactDesc: 'Contact the author to join the group and provide online feedback.',
      githubIssues: 'Github Issues',
      githubIssuesDesc: 'Submit bugs or feature requests.',
      submitIssue: 'Submit Issue',
      faq: 'FAQ'
    }
  }

  const t = content[language]

  return (
    <DocLayout title={i18nTexts.homeFeedback[language]}>
      <div className="space-y-8 text-slate-600">
        <p className="text-lg leading-relaxed">
          {t.intro}
        </p>

        <div className="grid gap-6 md:grid-cols-2 mt-8">

          {/* Online Contact */}
          <div className="p-6 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-5 w-5 text-green-600"/>
              </div>
              <h3 className="font-semibold text-slate-900">{t.onlineContact}</h3>
            </div>
            <div className="flex justify-center mt-2 mb-4">
              <img src="/contact.png" alt={t.onlineContact}
                   className="w-32 h-32 object-contain rounded-lg border border-slate-100"/>
            </div>
            <p className="text-sm text-slate-500 text-center">{t.onlineContactDesc}</p>
          </div>

          {/* Github Issues */}
          <div className="p-6 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-shadow flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Github className="h-5 w-5 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-900">{t.githubIssues}</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4 flex-1">{t.githubIssuesDesc}</p>
            <div className="flex justify-end mt-auto">
              <Button asChild size="sm">
                <a href="https://github.com/stone-yu/ai-draw/issues" target="_blank" rel="noopener noreferrer">
                  {t.submitIssue}
                </a>
              </Button>
            </div>
          </div>

        </div>

        <div className="mt-12 p-6 bg-slate-50 rounded-xl border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-4">{t.faq}</h3>
          <div className="space-y-4">
            {FAQ_DATA[language].map((item, index) => (
              <div key={index}>
                <details className="group">
                  <summary className="flex justify-between items-center font-medium cursor-pointer list-none text-slate-900">
                    <span>{item.question}</span>
                    <span className="transition group-open:rotate-180">
                      <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <div className="mt-3 group-open:animate-fadeIn text-sm leading-relaxed">
                    <SimpleMarkdown content={item.answer} />
                  </div>
                </details>
                {index < FAQ_DATA[language].length - 1 && <div className="h-px bg-slate-200 my-4"></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DocLayout>
  )
}

