import Uploader from "./components/Uploader";

const PIPELINE = [
  { step: "Upload", detail: "Straight to the S3 raw bucket" },
  { step: "Queue", detail: "S3 event lands in SQS" },
  { step: "Transcode", detail: "ECS Fargate runs ffmpeg" },
  { step: "Deliver", detail: "720p · 480p · 360p in S3" },
];

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 py-16 sm:py-24">
      <header className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Cloud-native transcoding on AWS
        </span>
        <h1 className="mt-6 bg-linear-to-b from-white to-white/60 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
          Video Transcoder
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-base text-white/50">
          Upload a raw video and get back streaming-ready 720p, 480p, and 360p renditions —
          transcoded automatically by a serverless ffmpeg pipeline.
        </p>
      </header>

      <section className="mt-12">
        <Uploader />
      </section>

      <section className="mt-14">
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PIPELINE.map((item, i) => (
            <li key={item.step} className="rounded-2xl border border-white/10 bg-white/20 p-4">
              <span className="text-xs font-semibold text-indigo-300/80">Step {i + 1}</span>
              <p className="mt-1 text-sm font-medium text-white">{item.step}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/40">{item.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-16 text-center text-xs text-white/30">
        Next.js · NestJS · AWS S3 · SQS · ECS Fargate
      </footer>
    </main>
  );
}
