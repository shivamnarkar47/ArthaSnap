import { HeadContent, Scripts, createRootRoute, Link } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ThemeSwitch } from '../components/theme-switch'

import appCss from '../styles.css?url'

const MODE_SNIPPET = `try{var m=localStorage.getItem('arthasnap-mode')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.mode=m;if(m==='dark')document.documentElement.classList.add('dark')}catch(e){}`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: MODE_SNIPPET }} />
      </head>
      <body>
        <header className="page-wrap flex items-center justify-between py-4">
          <Link to="/" search={{ symbols: '' }} className="display-title text-lg font-bold no-underline">
            ArthaSnap
          </Link>
          <ThemeSwitch />
        </header>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
