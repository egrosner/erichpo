import { createRoute, Link } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { GitBranch, MessageSquare, Zap, Users, Archive, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/auth'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">erichpo</span>
          </div>
          <HeaderNav />
        </div>
      </header>

      <main>
        <section className="py-24 px-6">
          <div className="container mx-auto text-center max-w-3xl">
            <Badge variant="secondary" className="mb-4">
              Open Source
            </Badge>
            <h1 className="text-5xl font-bold tracking-tight mb-6">
              Bridge GitHub and Slack for Better Code Reviews
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Automatically create dedicated Slack channels for every pull request.
              Sync comments, reviews, and CI status in real-time. Keep your team in the loop.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" asChild>
                <a href="/api/oauth/slack/install">Get Started</a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#how-it-works">Learn More</a>
              </Button>
            </div>
          </div>
        </section>

        <Separator />

        <section id="features" className="py-24 px-6 bg-muted/50">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-12">
              Everything you need for seamless PR collaboration
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={<MessageSquare className="h-6 w-6" />}
                title="Bidirectional Sync"
                description="Comments flow both ways. Reply in Slack or GitHub—everyone stays updated."
              />
              <FeatureCard
                icon={<Zap className="h-6 w-6" />}
                title="Real-time Updates"
                description="CI status, reviews, and approvals appear in Slack the moment they happen."
              />
              <FeatureCard
                icon={<Users className="h-6 w-6" />}
                title="Auto User Mapping"
                description="Automatically links GitHub and Slack users so mentions work across platforms."
              />
              <FeatureCard
                icon={<GitBranch className="h-6 w-6" />}
                title="Dedicated Channels"
                description="Each PR gets its own temporary channel for focused discussion."
              />
              <FeatureCard
                icon={<Archive className="h-6 w-6" />}
                title="Auto Archive"
                description="Channels are automatically archived when PRs are merged or closed."
              />
              <FeatureCard
                icon={<Bell className="h-6 w-6" />}
                title="Smart Notifications"
                description="Get notified about reviews, comments, and status changes that matter to you."
              />
            </div>
          </div>
        </section>

        <Separator />

        <section id="how-it-works" className="py-24 px-6">
          <div className="container mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-12">
              How it works
            </h2>
            <div className="space-y-6">
              <Step
                number={1}
                title="Install the GitHub App"
                description="Add erichpo to your GitHub organization. Select which repositories to enable."
              />
              <Step
                number={2}
                title="Connect Slack"
                description="Authorize erichpo in your Slack workspace and link it to your GitHub installation."
              />
              <Step
                number={3}
                title="Open a PR"
                description="A dedicated Slack channel is created automatically. Your team gets notified."
              />
              <Step
                number={4}
                title="Collaborate"
                description="Discuss in Slack or GitHub—comments sync both ways. Merge and the channel archives."
              />
            </div>
          </div>
        </section>

        <Separator />

        <section className="py-24 px-6 bg-muted/50">
          <div className="container mx-auto text-center max-w-2xl">
            <h2 className="text-3xl font-bold mb-4">
              Ready to streamline your code reviews?
            </h2>
            <p className="text-muted-foreground mb-8">
              Get started in minutes. No credit card required.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-6">
        <div className="container mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            <span>erichpo</span>
          </div>
          <p>Bidirectional GitHub-Slack PR integration</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className="text-primary mb-2">{icon}</div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  )
}

function Step({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description: string
}) {
  return (
    <Card>
      <CardContent className="flex gap-4 pt-6">
        <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
          {number}
        </div>
        <div>
          <CardTitle className="text-lg mb-1">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardContent>
    </Card>
  )
}

function HeaderNav() {
  const { isAuthenticated, isLoading, user, login } = useAuth()

  return (
    <nav className="flex items-center gap-6">
      <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
        Features
      </a>
      <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
        How it Works
      </a>
      {isLoading ? (
        <Button disabled>Loading...</Button>
      ) : isAuthenticated ? (
        <>
          <span className="text-sm text-muted-foreground">{user?.githubUsername}</span>
          <Button asChild>
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </>
      ) : (
        <Button variant="outline" onClick={login}>
          Sign in with GitHub
        </Button>
      )}
    </nav>
  )
}
