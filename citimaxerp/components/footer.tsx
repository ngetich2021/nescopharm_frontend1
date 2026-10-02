import { Github, Twitter } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-4 md:justify-start">
            <Link href="/landing" className="text-sm font-medium">
              Home
            </Link>
            <Link href="/about" className="text-sm font-medium">
              About
            </Link>
            <Link href="/privacy" className="text-sm font-medium">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm font-medium">
              Terms of Service
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com/cherry-chat"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </Link>
            <Link
              href="https://twitter.com/cherry_chat"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Twitter className="h-5 w-5" />
              <span className="sr-only">Twitter</span>
            </Link>
          </div>
          <div className="text-sm text-muted-foreground text-center md:text-right">
            © {new Date().getFullYear()} Cherry Chat. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
