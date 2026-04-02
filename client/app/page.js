'use client';

import Link from 'next/link';
import { BookIcon, UserIcon, SearchIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-sm border-b border-[#1e1e2e] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gradient">Think Twice</h1>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="md">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" size="md">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#1e1e2e] bg-[#1a1a27] mb-6 text-xs text-zinc-400">
            <span>✨</span>
            <span>For engineering teams</span>
          </div>

          <h2 className="text-5xl font-bold tracking-tight text-white leading-tight mb-6">
            Document decisions.<br />Debug faster.
          </h2>

          <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-8">
            A structured knowledge base for your team's architecture decisions, debugging playbooks, and best practices. Never lose critical context again.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/register">
              <Button variant="primary" size="lg">Get Started</Button>
            </Link>
            <Button variant="ghost" size="lg">Learn More</Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-[#12121a]/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-8">
              <div className="w-12 h-12 bg-indigo-600/10 rounded-lg p-2.5 mb-4">
                <BookIcon className="w-full h-full text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-200 mt-4 mb-2">
                Structured Logging
              </h3>
              <p className="text-sm text-zinc-400">
                What, Why, Do's & Don'ts for every decision. Built-in templates keep your documentation consistent.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-8">
              <div className="w-12 h-12 bg-indigo-600/10 rounded-lg p-2.5 mb-4">
                <UserIcon className="w-full h-full text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-200 mt-4 mb-2">
                Team Knowledge
              </h3>
              <p className="text-sm text-zinc-400">
                Shared architecture context across your organization. Multi-tenant support for growing teams.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-8">
              <div className="w-12 h-12 bg-indigo-600/10 rounded-lg p-2.5 mb-4">
                <SearchIcon className="w-full h-full text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-200 mt-4 mb-2">
                Instant Search
              </h3>
              <p className="text-sm text-zinc-400">
                Find past incidents and solutions in seconds. Full-text search with type filters and tags.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-2xl font-semibold text-white mb-4">
            Ready to simplify your engineering process?
          </h3>
          <p className="text-zinc-400 mb-8">
            Start documenting your team's decisions and practices today.
          </p>
          <Link href="/register">
            <Button variant="primary" size="lg">Sign up for free</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e1e2e] py-12 px-6">
        <div className="max-w-7xl mx-auto text-center text-sm text-zinc-500">
          <p>Think Twice © 2024. A knowledge platform for engineering teams.</p>
        </div>
      </footer>
    </div>
  );
}
