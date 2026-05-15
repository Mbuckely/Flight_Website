"use client";

import { useEffect, useState } from "react";
import ScrollReveal from "@/components/ui/ScrollReveal";

const contactDetails = [
  {
    label: "Email",
    value: "support@ridetego.com",
  },
  {
    label: "Phone",
    value: "(800) 555-0148",
  },
  {
    label: "Hours",
    value: "Monday - Friday, 9:00 AM - 4:00 PM",
  },
];

const fieldClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base text-slate-900 outline-none transition focus:border-blue-700";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setName("");
    setEmail("");
    setCompany("");
    setMessage("");
    setSubmitted(true);
  };

  useEffect(() => {
    if (!submitted) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSubmitted(false);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [submitted]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-blue-50 px-6 py-20">
      <section className="mx-auto max-w-6xl">
        <ScrollReveal delayMs={0}>
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
              Contact
            </p>
            <h1 className="mt-4 text-4xl font-bold text-slate-900 md:text-5xl">
              Let&apos;s make business travel easier for your team.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Reach out with questions about booking, transportation, or how
              RideTego can support your organization. We&apos;ll point you in
              the right direction.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-14 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <ScrollReveal delayMs={80}>
            <aside className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-semibold text-slate-900">
                Contact Information
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Our team is available to answer questions and help you find the
                right next step.
              </p>

              <div className="mt-8 grid gap-4">
                {contactDetails.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl bg-slate-50 px-5 py-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                      {item.label}
                    </p>
                    <p className="mt-2 text-base font-medium text-slate-700">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          </ScrollReveal>

          <ScrollReveal delayMs={160}>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-lg">
              <h2 className="text-2xl font-semibold text-slate-900">
                Send a Message
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Share a few details and we&apos;ll follow up with the right
                information.
              </p>

              <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      Name
                    </span>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={fieldClassName}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      Work Email
                    </span>
                    <input
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={fieldClassName}
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    Company
                  </span>
                  <input
                    type="text"
                    placeholder="Company name"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    className={fieldClassName}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    Message
                  </span>
                  <textarea
                    placeholder="Tell us what you need help with."
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={6}
                    className={`${fieldClassName} resize-none`}
                  />
                </label>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    type="submit"
                    className="rounded-2xl bg-blue-900 px-7 py-4 text-base font-semibold text-white transition hover:bg-blue-800"
                  >
                    Send Message
                  </button>

                  {submitted && (
                    <p className="text-sm font-medium text-green-700">
                      Thanks. Your message has been received.
                    </p>
                  )}
                </div>
              </form>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
