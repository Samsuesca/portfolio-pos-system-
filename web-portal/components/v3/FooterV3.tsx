import Image from "next/image";
import Link from "next/link";
import { fetchBusinessInfo, fetchSchools } from "@/lib/serverApi";

export async function FooterV3(): Promise<React.JSX.Element> {
  const [info, schools] = await Promise.all([
    fetchBusinessInfo(),
    fetchSchools(),
  ]);

  const currentYear = new Date().getFullYear();
  // Show up to 4 schools by display_order, last link goes to home where the
  // full picker lives.
  const featuredSchools = schools.filter((s) => s.is_active).slice(0, 4);

  return (
    <footer className="bg-[#0F0E0C] text-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Image
              src="/v3/logo-lockup-dark.png"
              alt={info?.business_name ?? "Uniformes Consuelo Rios"}
              width={140}
              height={48}
              style={{ height: 48, width: "auto" }}
            />
            <p className="mt-6 text-sm leading-relaxed text-stone-300 max-w-xs">
              Uniformes escolares confeccionados en {info?.city ?? "Medellín"}.
            </p>
          </div>

          <FooterColumn title="Colegios">
            {featuredSchools.map((s) => (
              <Link key={s.id} href={`/${s.slug}`}>
                {s.name}
              </Link>
            ))}
            <Link href="/">Ver todos</Link>
          </FooterColumn>

          <FooterColumn title="Tienda">
            <Link href="/">Catálogo</Link>
            <Link href="/encargos-personalizados">A medida</Link>
            <Link href="/soporte">Tallajes</Link>
            <Link href="/soporte">Garantía</Link>
          </FooterColumn>

          <FooterColumn title="Contacto">
            {info?.address_line1 && (
              <span>
                {info.address_line1}
                {info.address_line2 && `, ${info.address_line2}`}
              </span>
            )}
            {info?.hours_weekday && <span>{info.hours_weekday}</span>}
            {info?.phone_main && (
              <a href={`tel:${info.phone_main.replace(/\s/g, "")}`}>
                {info.phone_main}
              </a>
            )}
            {info?.email_contact && (
              <a href={`mailto:${info.email_contact}`}>{info.email_contact}</a>
            )}
            {info?.whatsapp_number && (
              <a
                href={`https://wa.me/${info.whatsapp_number}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            )}
          </FooterColumn>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row md:justify-between gap-2 text-xs font-mono tracking-wider uppercase text-stone-400">
          <span>
            © {currentYear} {info?.business_name ?? "Uniformes Consuelo Ríos"}
          </span>
          <span>Hecho en {info?.city ?? "Medellín"}</span>
        </div>
      </div>
    </footer>
  );
}

interface FooterColumnProps {
  title: string;
  children: React.ReactNode;
}

function FooterColumn({ title, children }: FooterColumnProps): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <div className="text-[11px] font-mono font-semibold tracking-[0.18em] uppercase text-brand-400 mb-4">
        {title}
      </div>
      <div className="flex flex-col gap-2 text-sm text-stone-300 [&_a]:hover:text-white [&_a]:transition-colors">
        {children}
      </div>
    </div>
  );
}
