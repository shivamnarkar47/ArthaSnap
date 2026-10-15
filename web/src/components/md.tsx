import Markdown from 'react-markdown'

export function Md({ text }: { text: string }) {
  return (
    <div className="min-w-0 break-words text-sm leading-6 [overflow-wrap:anywhere]">
      <Markdown
        components={{
          h1: (p) => <h3 className="mb-2 text-base font-bold" {...p} />,
          h2: (p) => <h4 className="mb-1 mt-4 text-sm font-bold uppercase tracking-wide text-muted-foreground" {...p} />,
          h3: (p) => <h4 className="mb-1 mt-3 text-sm font-bold" {...p} />,
          p: (p) => <p className="mb-2 break-words [overflow-wrap:anywhere]" {...p} />,
          ul: (p) => <ul className="mb-3 ml-4 list-disc space-y-1" {...p} />,
          ol: (p) => <ol className="mb-3 ml-4 list-decimal space-y-1" {...p} />,
          li: (p) => <li className="pl-1 break-words [overflow-wrap:anywhere]" {...p} />,
          strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
          a: (p) => <a className="underline underline-offset-2 [overflow-wrap:anywhere]" target="_blank" rel="noreferrer" {...p} />,
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {text}
      </Markdown>
    </div>
  )
}
