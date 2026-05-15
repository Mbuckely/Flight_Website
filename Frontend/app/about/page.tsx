const aboutCards = [
  {
    title: "Our Mission",
    body: "Our mission is to streamline corporate travel through a centralized platform that enables businesses to book, manage, and optimize travel with efficiency and clarity.",
  },
  {
    title: "Enterprise Solutions",
    body: "From flight booking to ground transportation, RideTego delivers a unified experience for managing all corporate travel needs in one place.",
  },
  {
    title: "Why RideTego",
    body: "We combine real time data, intuitive workflows, and enterprise-grade reliability to help organizations reduce costs and improve travel efficiency.",
  },
  {
    title: "Our Vision",
    body: "We are shaping the future of corporate mobility by integrating automation, analytics, and seamless booking into a single intelligent platform.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-14 sm:py-20">

      {/* HERO SECTION */}
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-blue-900 sm:text-5xl">
          About RideTego
        </h1>

        <p className="mx-auto max-w-3xl text-lg leading-relaxed text-gray-600 sm:text-xl">
          RideTego is a modern corporate travel platform built to simplify how
          organizations manage flights, transportation, and employee travel at scale.
        </p>
      </div>

      {/* FEATURE GRID */}
      <div className="mx-auto mt-14 grid max-w-6xl gap-6 sm:mt-20 md:grid-cols-2 md:gap-10">
        {aboutCards.map((card, index) => (
          <div
            key={card.title}
            className="animate-fade-in rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition hover:shadow-md"
            style={{
              animationDelay: `${index * 260}ms`,
              animationDuration: "0.95s",
              animationFillMode: "both",
            }}
          >
            <h2 className="mb-4 text-2xl font-semibold text-blue-900">
              {card.title}
            </h2>
            <p className="leading-relaxed text-gray-600">{card.body}</p>
          </div>
        ))}
      </div>

      {/* CTA SECTION */}
      <div className="mx-auto mt-20 max-w-4xl text-center sm:mt-24">
        <h2 className="mb-4 text-2xl font-semibold text-blue-900 sm:text-3xl">
          Ready to streamline your corporate travel?
        </h2>

        <p className="text-gray-600 mb-8">
          Join companies that trust RideTego to manage travel efficiently and professionally.
        </p>

        <a
          href="/signup"
          className="inline-block rounded-xl bg-red-600 px-8 py-4 text-lg font-medium text-white transition hover:bg-red-700"
        >
          Get Started
        </a>
      </div>

    </div>
  );
}
