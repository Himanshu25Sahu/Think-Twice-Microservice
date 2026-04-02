import { redirect } from 'next/navigation';

export default function AboutPage() {
  redirect('/');
}
      timer = setTimeout(() => setCurrentStep((prev) => prev + 1), 1200);
    }
    if (currentStep === steps.length - 1) {
      setTimeout(() => setFinished(true), 1500);
    }
    return () => clearTimeout(timer);
  }, [isRunning, currentStep, steps.length]);

  const startPipeline = () => {
    setCurrentStep(-1);
    setFinished(false);
    setIsRunning(true);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex flex-col items-center px-6 py-12">
        {/* Title */}
        <h1 className="text-5xl md:text-6xl font-extrabold text-center mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
          Think Twice
        </h1>

        <p className="text-lg text-gray-300 text-center max-w-3xl mb-10">
          Think Twice is a full-stack <span className="text-blue-400 font-semibold">DevOps showcase</span>. 
          It demonstrates production-ready architecture with containerized services, CI/CD pipelines, zero-click cloud deployments, 
          and optimized performance through <span className="text-blue-400 font-semibold">Redis caching for feed posts</span>.
          <br />
          <span className="text-green-400 font-semibold">Load tested locally with 300+ concurrent users</span> to ensure scalability and reliability.
        </p>

        <button
          onClick={() => router.push("/dashboard")}
          className="px-6 py-3 rounded-xl text-lg font-semibold shadow-lg transition mb-8 bg-gray-700 hover:bg-gray-600 cursor-pointer"
        >
          Explore the app
        </button>

        {/* Pipeline Simulation */}
        <button
          onClick={startPipeline}
          disabled={isRunning}
          className={`px-6 py-3 rounded-xl text-lg font-semibold shadow-lg transition mb-8 ${
            isRunning ? "bg-gray-700 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isRunning ? "Running Pipeline..." : "Simulate Push to GitHub"}
        </button>

        {/* Steps */}
        <div className="w-full max-w-2xl flex flex-col space-y-4">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className={`flex flex-col md:flex-row md:items-center justify-between px-4 py-3 rounded-xl border transition-all duration-500 ${
                idx <= currentStep
                  ? "border-green-500 bg-green-900/20"
                  : "border-gray-700 bg-gray-800/50"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`h-3 w-3 rounded-full ${
                    idx < currentStep
                      ? "bg-green-400"
                      : idx === currentStep
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-gray-500"
                  }`}
                ></div>
                <p className="text-base font-medium">
                  {idx < currentStep ? "✅ " : idx === currentStep ? "⚙️ " : "⏳ "}
                  {step.name}
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-2 md:mt-0 md:ml-4">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Final Message */}
        {finished && (
          <div className="mt-8 text-center">
            <p className="text-green-400 text-xl font-bold animate-bounce">
              🎉 Deployment Successful! Your app is live.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Backend on Render | Frontend on Vercel | Powered by GitHub Actions
            </p>
          </div>
        )}

        {/* Tech Stack */}
        <div className="max-w-3xl text-center mt-14">
          <h3 className="text-xl font-bold mb-3 text-gray-200">🔧 Under the Hood</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            <span className="text-blue-400 font-medium">Frontend:</span> Next.js, TailwindCSS, Redux <br />
            <span className="text-blue-400 font-medium">Backend:</span> Express.js, Node.js, MongoDB Atlas <br />
            <span className="text-blue-400 font-medium">Caching & Performance:</span> Redis caching for feed posts, pagination optimization, cache-first strategy <br />
            <span className="text-blue-400 font-medium">Infrastructure:</span> Docker, Render, Vercel, environment configuration <br />
            <span className="text-blue-400 font-medium">Pipeline & DevOps:</span> GitHub Actions, CI/CD, Docker Hub, production readiness, load testing
          </p>
        </div>

        {/* Footer */}
        <footer className="mt-10 text-xs text-gray-600 text-center">
          Made with ❤️ to showcase full-stack engineering, production readiness, and DevOps skills
        </footer>
      </div>
    </DashboardLayout>
  );
}
