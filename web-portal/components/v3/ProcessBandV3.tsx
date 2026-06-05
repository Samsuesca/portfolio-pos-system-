import { Eyebrow } from "./primitives/Eyebrow";

const STEPS = [
  {
    n: "01",
    title: "Eliges",
    body: "Colegio, prenda y talla. Catálogo oficial aprobado por cada institución.",
  },
  {
    n: "02",
    title: "Confeccionamos",
    body: "Producción en taller propio en Medellín, con telas y bordados oficiales.",
  },
  {
    n: "03",
    title: "Confirmamos",
    body: "Asesora WhatsApp valida medidas, escudos y monogramas antes del corte.",
  },
  {
    n: "04",
    title: "Entregamos",
    body: "A domicilio en Medellín 1–2 días hábiles, o recoge en taller.",
  },
];

export function ProcessBandV3(): React.JSX.Element {
  return (
    <section className="bg-surface-200 py-24 lg:py-32 border-y border-stone-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-3 gap-10 lg:gap-16 mb-14 lg:mb-16">
          <div className="lg:col-span-1">
            <Eyebrow>Cómo funciona</Eyebrow>
            <h2
              className="mt-5 font-editorial font-medium text-stone-900 tracking-[-0.03em] leading-[1] text-4xl sm:text-5xl lg:text-[56px]"
              style={{ fontVariationSettings: '"opsz" 120' }}
            >
              De la <em className="italic font-normal text-brand-600">medida</em>
              <br />
              al primer día.
            </h2>
          </div>
          <p className="lg:col-span-2 lg:self-end text-base sm:text-lg leading-relaxed text-stone-600 max-w-2xl">
            Cuatro pasos, sin filas. Todo el proceso lo coordinamos por WhatsApp
            antes de cortar la tela, para que cada prenda salga del taller con
            las medidas correctas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0">
          {STEPS.map(({ n, title, body }) => (
            <div
              key={n}
              className="lg:pr-6 pt-5 border-t border-stone-900"
            >
              <div className="flex justify-between items-baseline mb-8">
                <span className="text-[13px] font-mono font-semibold tracking-[0.18em] text-brand-600">
                  {n}
                </span>
                <span className="text-[11px] font-mono font-normal tracking-[0.18em] uppercase text-stone-400">
                  Paso
                </span>
              </div>
              <div
                className="font-editorial italic font-medium text-stone-900 text-3xl leading-[1.05] mb-3"
                style={{ fontVariationSettings: '"opsz" 96' }}
              >
                {title}
              </div>
              <div className="text-sm leading-relaxed text-stone-600">
                {body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
