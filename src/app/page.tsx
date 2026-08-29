'use client';

import { useState } from 'react';
import {
  Button,
  Input,
  Badge,
  StatusBadge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui';

export default function Home() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);

    // Simple validation
    if (value && !value.includes('@')) {
      setError('Please enter a valid email');
    } else {
      setError('');
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      {/* Header with theme toggle */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">jlab</h1>
          <Button intent="ghost" size="sm" onClick={toggleDarkMode} aria-label="Toggle dark mode">
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="space-y-12">
          {/* Hero section */}
          <section className="space-y-4">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              Modern Plasmid Management
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
              jlab is a modern reimplementation of the legacy GMOCU plasmid and GMO management
              application with improved UX, maintainability, and security.
            </p>
          </section>

          {/* Design system showcase */}
          <section className="space-y-8">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Design System
            </h3>

            {/* Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Buttons</CardTitle>
                <CardDescription>
                  Interactive elements with multiple intents and sizes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Primary Button
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      <Button intent="primary" size="sm">
                        Small
                      </Button>
                      <Button intent="primary" size="md">
                        Medium
                      </Button>
                      <Button intent="primary" size="lg">
                        Large
                      </Button>
                      <Button intent="primary" disabled>
                        Disabled
                      </Button>
                      <Button intent="primary" loading>
                        Loading...
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Secondary Button
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      <Button intent="secondary" size="sm">
                        Small
                      </Button>
                      <Button intent="secondary" size="md">
                        Medium
                      </Button>
                      <Button intent="secondary" size="lg">
                        Large
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Danger Button
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      <Button intent="danger" size="sm">
                        Delete
                      </Button>
                      <Button intent="danger" size="md">
                        Remove
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Ghost Button
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      <Button intent="ghost" size="sm">
                        Cancel
                      </Button>
                      <Button intent="ghost" size="md">
                        More
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inputs */}
            <Card>
              <CardHeader>
                <CardTitle>Form Inputs</CardTitle>
                <CardDescription>Text inputs with validation states and labels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 max-w-md">
                  <Input
                    label="Plasmid Name"
                    placeholder="e.g., pGMO-001"
                    caption="Use project prefix for consistency"
                  />

                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    error={error}
                    placeholder="user@example.com"
                    required
                  />

                  <Input label="Vector Type" state="success" value="pUC19" disabled />

                  <Input label="Size" type="number" placeholder="bp" inputSize="sm" />
                </div>
              </CardContent>
            </Card>

            {/* Badges */}
            <Card>
              <CardHeader>
                <CardTitle>Status Badges</CardTitle>
                <CardDescription>Indicators for status, tags, and labels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    <StatusBadge status="success" />
                    <StatusBadge status="warning" />
                    <StatusBadge status="error" />
                    <StatusBadge status="info" />
                    <StatusBadge status="draft" />
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="success" size="sm">
                      Success
                    </Badge>
                    <Badge variant="warning" size="md">
                      Warning
                    </Badge>
                    <Badge variant="error" size="lg">
                      Error
                    </Badge>
                    <Badge variant="info">Info</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Typography */}
            <Card>
              <CardHeader>
                <CardTitle>Typography</CardTitle>
                <CardDescription>Text styles following the hierarchy</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                      Page Title (36px)
                    </h2>
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      Section Heading (24px)
                    </h3>
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      Subsection (20px)
                    </h4>
                  </div>
                  <div>
                    <p className="text-base font-normal text-gray-600 dark:text-gray-400">
                      Body text (16px) - For descriptions and explanations
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-normal text-gray-600 dark:text-gray-400">
                      Small text (14px) - For table cells and labels
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-normal text-gray-500 dark:text-gray-500">
                      Caption text (12px) - For helper text and metadata
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Next steps */}
          <section className="space-y-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Next Steps</h3>
            <p className="text-blue-800 dark:text-blue-200">
              The design system foundation is ready. Next phase:
            </p>
            <ul className="text-blue-800 dark:text-blue-200 space-y-2 ml-4 list-disc">
              <li>Build the plasmid data table with sorting/filtering</li>
              <li>Implement detail panel with form-style editing</li>
              <li>Connect to backend PlasmidService API</li>
              <li>Add search and bulk operations</li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
