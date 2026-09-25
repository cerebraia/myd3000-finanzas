import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { getQuoteById } from '@/services/quotes'
import { getCompanySettings, DEFAULT_COMPANY } from '@/services/company'
import { quotesKeys, companyKeys } from '@/lib/queryKeys'
import { formatCurrency, formatQuoteNumber, formatDate } from '@/utils/formatters'
import { PROJECT_TYPE_LABELS } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMeasures(h: number | null, w: number | null, d: number | null): string {
  const parts = [h, w, d].filter((v): v is number => v != null && v > 0)
  if (parts.length === 0) return ''
  return parts.map(v => v.toFixed(2)).join(' × ') + ' m'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '8pt',
      fontWeight: 600,
      color: '#6b7a90',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      marginBottom: '10px',
    }}>
      {children}
    </p>
  )
}

const NAVY = '#0f2040'
const NAVY_TEXT = '#1a2332'
const MUTED = '#6b7a90'
const BORDER = '#e2e8f0'
const STRIPE = '#f8fafc'

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuotePrint() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: quote, isLoading } = useQuery({
    queryKey: quotesKeys.detail(id!),
    queryFn: () => getQuoteById(id!),
    enabled: !!id,
  })

  const { data: company } = useQuery({
    queryKey: companyKeys.settings,
    queryFn: getCompanySettings,
    staleTime: 1000 * 60 * 10,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: NAVY }} />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p style={{ color: MUTED }}>Cotización no encontrada.</p>
        <button onClick={() => navigate('/cotizaciones')} style={{ color: NAVY }} className="text-sm hover:underline">
          Volver
        </button>
      </div>
    )
  }

  const quoteNum = formatQuoteNumber(quote.quote_number, new Date(quote.issue_date).getFullYear())
  const paymentTerms = quote.payment_terms ?? []

  const companyName      = company?.company_name      ?? DEFAULT_COMPANY.company_name      ?? 'Muebles y Decoraciones 3000 C.A.'
  const companyTaxId     = company?.tax_id            ?? null
  const companyPhone     = company?.phone             ?? null
  const companyEmail     = company?.email             ?? null
  const companyAddress   = company?.address           ?? null
  const signerName       = company?.authorized_signer_name     ?? null
  const signerPosition   = company?.authorized_signer_position ?? 'Representante autorizado'

  // Fallback payment when no payment_terms exist
  const initialAmt = quote.total * (quote.initial_payment_percentage / 100)
  const finalAmt   = quote.total - initialAmt

  return (
    <>
      {/* ── Screen-only nav bar ── */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => navigate(`/cotizaciones/${id}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={16} />
          Volver
        </button>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-400 hidden sm:block">{quoteNum}</p>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: NAVY }}
          >
            <Printer size={15} />
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* ── Print document ── */}
      <div className="print-page pt-16">
        <div className="print-body mx-auto bg-white" style={{ maxWidth: '800px', padding: '48px 48px 40px' }}>

          {/* ── A. ENCABEZADO ── */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingBottom: '20px',
            borderBottom: `3px solid ${NAVY}`,
            marginBottom: '28px',
          }}>
            {/* Logo + empresa */}
            <div>
              <img
                src="/logo/MYD3000 - Logo.png"
                alt="MYD3000"
                style={{ height: '52px', display: 'block', objectFit: 'contain' }}
              />
              <p style={{ fontSize: '8pt', color: MUTED, marginTop: '6px', fontWeight: 600, letterSpacing: '0.05em' }}>
                {companyName.toUpperCase()}
              </p>
              {companyTaxId && (
                <p style={{ fontSize: '7.5pt', color: MUTED, marginTop: '2px' }}>RIF: {companyTaxId}</p>
              )}
              {companyPhone && (
                <p style={{ fontSize: '7.5pt', color: MUTED, marginTop: '1px' }}>{companyPhone}</p>
              )}
              {companyEmail && (
                <p style={{ fontSize: '7.5pt', color: MUTED, marginTop: '1px' }}>{companyEmail}</p>
              )}
            </div>
            {/* Número de cotización */}
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '7.5pt', color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                Cotización
              </p>
              <p style={{ fontSize: '20pt', fontWeight: 700, color: NAVY, marginTop: '2px', lineHeight: 1 }}>
                {quoteNum}
              </p>
              <p style={{ fontSize: '8.5pt', color: MUTED, marginTop: '6px' }}>
                Fecha: {formatDate(quote.issue_date)}
              </p>
              {quote.valid_until && (
                <p style={{ fontSize: '7.5pt', color: MUTED, marginTop: '2px' }}>
                  Válida hasta: {formatDate(quote.valid_until)}
                </p>
              )}
            </div>
          </div>

          {/* ── B+C. CLIENTE + PROYECTO ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '28px' }}>
            {/* Cliente */}
            <div>
              <SectionLabel>Cliente</SectionLabel>
              {quote.client ? (
                <>
                  <p style={{ fontSize: '11pt', fontWeight: 700, color: NAVY_TEXT }}>
                    {quote.client.full_name}
                  </p>
                  {quote.client.document_type && quote.client.document_number && (
                    <p style={{ fontSize: '8.5pt', color: MUTED, marginTop: '3px' }}>
                      {quote.client.document_type}: {quote.client.document_number}
                    </p>
                  )}
                  {quote.client.phone && (
                    <p style={{ fontSize: '8.5pt', color: MUTED, marginTop: '2px' }}>{quote.client.phone}</p>
                  )}
                  {quote.client.email && (
                    <p style={{ fontSize: '8.5pt', color: MUTED, marginTop: '2px' }}>{quote.client.email}</p>
                  )}
                  {quote.client.address && (
                    <p style={{ fontSize: '8.5pt', color: MUTED, marginTop: '2px' }}>{quote.client.address}</p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: '9pt', color: MUTED }}>—</p>
              )}
            </div>
            {/* Proyecto */}
            {(quote.title || quote.project_type || quote.responsible_architect_name) && (
              <div>
                <SectionLabel>Proyecto</SectionLabel>
                {quote.title && (
                  <p style={{ fontSize: '11pt', fontWeight: 700, color: NAVY_TEXT }}>{quote.title}</p>
                )}
                {quote.project_type && (
                  <p style={{ fontSize: '8.5pt', color: MUTED, marginTop: '3px' }}>
                    {PROJECT_TYPE_LABELS[quote.project_type] ?? quote.project_type}
                  </p>
                )}
                {quote.responsible_architect_name && (
                  <p style={{ fontSize: '8.5pt', color: MUTED, marginTop: '2px' }}>
                    Arq. {quote.responsible_architect_name}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── D. TABLA DE ITEMS ── */}
          {(quote.items ?? []).length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <SectionLabel>Descripción del trabajo</SectionLabel>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                <thead>
                  <tr style={{ backgroundColor: NAVY, color: 'white' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: '7.5pt', letterSpacing: '0.06em', width: '40%' }}>
                      Descripción
                    </th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: '7.5pt', letterSpacing: '0.06em', width: '20%' }}>
                      Medidas
                    </th>
                    <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, fontSize: '7.5pt', letterSpacing: '0.06em', width: '8%' }}>
                      Cant.
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, fontSize: '7.5pt', letterSpacing: '0.06em', width: '16%' }}>
                      Precio unit.
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, fontSize: '7.5pt', letterSpacing: '0.06em', width: '16%' }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(quote.items ?? []).map((item, idx) => {
                    const measures = formatMeasures(item.height, item.width, item.depth)
                    return (
                      <tr
                        key={item.id}
                        style={{ backgroundColor: idx % 2 === 0 ? STRIPE : 'white', borderBottom: `1px solid ${BORDER}` }}
                      >
                        <td style={{ padding: '7px 10px', fontWeight: 500, color: NAVY_TEXT, verticalAlign: 'top' }}>
                          {item.description}
                        </td>
                        <td style={{ padding: '7px 10px', color: MUTED, verticalAlign: 'top', fontSize: '8pt' }}>
                          {measures || '—'}
                          {item.measurement_notes && (
                            <span style={{ display: 'block', color: '#94a3b8', fontSize: '7.5pt', marginTop: '2px' }}>
                              {item.measurement_notes}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'center', color: MUTED, verticalAlign: 'top' }}>
                          {item.quantity}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: MUTED, verticalAlign: 'top' }}>
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: NAVY_TEXT, verticalAlign: 'top' }}>
                          {formatCurrency(item.line_total)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* ── E. TOTAL ── */}
              <div className="print-protect" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <div style={{ width: '220px' }}>
                  {quote.discount > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5pt', color: MUTED, padding: '3px 0' }}>
                        <span>Subtotal</span>
                        <span>{formatCurrency(quote.subtotal)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5pt', color: MUTED, padding: '3px 0' }}>
                        <span>Descuento</span>
                        <span>−{formatCurrency(quote.discount)}</span>
                      </div>
                    </>
                  )}
                  {quote.tax > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5pt', color: MUTED, padding: '3px 0' }}>
                      <span>Impuestos</span>
                      <span>{formatCurrency(quote.tax)}</span>
                    </div>
                  )}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    borderTop: `2px solid ${NAVY}`, marginTop: '6px', paddingTop: '8px',
                    fontWeight: 700, color: NAVY,
                  }}>
                    <span style={{ fontSize: '9pt', letterSpacing: '0.06em' }}>MONTO TOTAL</span>
                    <span style={{ fontSize: '13pt' }}>{formatCurrency(quote.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── F. FORMA DE PAGO ── */}
          <div className="print-protect" style={{ marginBottom: '24px' }}>
            <SectionLabel>Forma de pago</SectionLabel>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', borderTop: `1px solid ${BORDER}` }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <th style={{ textAlign: 'left', padding: '7px 0', color: MUTED, fontWeight: 500, fontSize: '8pt' }}>Concepto</th>
                  <th style={{ textAlign: 'center', padding: '7px 0', color: MUTED, fontWeight: 500, fontSize: '8pt', width: '80px' }}>%</th>
                  <th style={{ textAlign: 'right', padding: '7px 0', color: MUTED, fontWeight: 500, fontSize: '8pt', width: '120px' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {paymentTerms.length > 0 ? (
                  paymentTerms.map((t, idx) => (
                    <tr key={t.id} style={{ borderBottom: idx < paymentTerms.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <td style={{ padding: '8px 0', color: NAVY_TEXT, fontWeight: 500 }}>{t.concept}</td>
                      <td style={{ padding: '8px 0', textAlign: 'center', color: MUTED }}>
                        {t.percentage != null ? `${t.percentage}%` : '—'}
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: NAVY }}>
                        {t.amount != null ? formatCurrency(t.amount) : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '8px 0', color: NAVY_TEXT, fontWeight: 500 }}>Anticipo</td>
                      <td style={{ padding: '8px 0', textAlign: 'center', color: MUTED }}>{quote.initial_payment_percentage}%</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: NAVY }}>{formatCurrency(initialAmt)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: NAVY_TEXT, fontWeight: 500 }}>Saldo final</td>
                      <td style={{ padding: '8px 0', textAlign: 'center', color: MUTED }}>{quote.final_payment_percentage}%</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: NAVY }}>{formatCurrency(finalAmt)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* ── G+H. INCLUYE / NO INCLUYE ── */}
          {((quote.includes ?? []).length > 0 || (quote.excludes ?? []).length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginBottom: '24px' }}>
              {(quote.includes ?? []).length > 0 && (
                <div>
                  <SectionLabel>Incluye</SectionLabel>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {quote.includes.map((item, i) => (
                      <li key={i} style={{
                        display: 'flex', gap: '8px', fontSize: '8.5pt', color: NAVY_TEXT,
                        padding: '3px 0', alignItems: 'flex-start',
                      }}>
                        <span style={{ color: '#059669', flexShrink: 0, fontWeight: 700, marginTop: '1px' }}>—</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(quote.excludes ?? []).length > 0 && (
                <div>
                  <SectionLabel>No incluye</SectionLabel>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {quote.excludes.map((item, i) => (
                      <li key={i} style={{
                        display: 'flex', gap: '8px', fontSize: '8.5pt', color: NAVY_TEXT,
                        padding: '3px 0', alignItems: 'flex-start',
                      }}>
                        <span style={{ color: '#dc2626', flexShrink: 0, fontWeight: 700, marginTop: '1px' }}>—</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── I. CONDICIONES ── */}
          {(quote.terms ?? []).length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <SectionLabel>Condiciones de la cotización</SectionLabel>
              <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {quote.terms.map((term, i) => (
                  <li key={i} style={{
                    display: 'flex', gap: '10px', fontSize: '8.5pt', color: NAVY_TEXT,
                    padding: '4px 0', alignItems: 'flex-start', lineHeight: 1.5,
                  }}>
                    <span style={{ color: MUTED, flexShrink: 0, fontWeight: 600, minWidth: '16px' }}>{i + 1}.</span>
                    {term}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* ── J. NOTAS ── */}
          {quote.notes && (
            <div style={{ marginBottom: '24px' }}>
              <SectionLabel>Observaciones</SectionLabel>
              <p style={{ fontSize: '8.5pt', color: NAVY_TEXT, lineHeight: 1.6 }}>{quote.notes}</p>
            </div>
          )}

          {/* ── K. FIRMAS ── */}
          <div className="print-protect" style={{
            borderTop: `1px solid ${BORDER}`,
            paddingTop: '28px',
            marginBottom: '24px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
              {/* Empresa */}
              <div>
                <div style={{ borderBottom: `1px solid ${NAVY_TEXT}`, height: '56px', marginBottom: '10px' }} />
                <p style={{ fontSize: '8.5pt', fontWeight: 700, color: NAVY_TEXT }}>{companyName}</p>
                <p style={{ fontSize: '7.5pt', color: MUTED, marginTop: '2px' }}>
                  {signerName ?? signerPosition}
                </p>
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '7.5pt', color: MUTED }}>Nombre: ___________________________</p>
                  <p style={{ fontSize: '7.5pt', color: MUTED, marginTop: '6px' }}>Cédula/RIF: ________________________</p>
                  <p style={{ fontSize: '7.5pt', color: MUTED, marginTop: '6px' }}>Fecha: _____________________________</p>
                </div>
              </div>
              {/* Cliente */}
              <div>
                <div style={{ borderBottom: `1px solid ${NAVY_TEXT}`, height: '56px', marginBottom: '10px' }} />
                <p style={{ fontSize: '8.5pt', fontWeight: 700, color: NAVY_TEXT }}>
                  {quote.client?.full_name ?? 'CLIENTE'}
                </p>
                <p style={{ fontSize: '7.5pt', color: MUTED, marginTop: '2px' }}>Aceptado por el cliente</p>
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '7.5pt', color: MUTED }}>Nombre: ___________________________</p>
                  <p style={{ fontSize: '7.5pt', color: MUTED, marginTop: '6px' }}>Cédula/RIF: ________________________</p>
                  <p style={{ fontSize: '7.5pt', color: MUTED, marginTop: '6px' }}>Fecha: _____________________________</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── L. PIE DE PÁGINA ── */}
          <div style={{
            borderTop: `1px solid ${BORDER}`,
            paddingTop: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <p style={{ fontSize: '7pt', color: MUTED }}>{companyName}</p>
              {companyAddress && (
                <p style={{ fontSize: '7pt', color: MUTED, marginTop: '1px' }}>{companyAddress}</p>
              )}
              {(companyPhone || companyEmail) && (
                <p style={{ fontSize: '7pt', color: MUTED, marginTop: '1px' }}>
                  {[companyPhone, companyEmail].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <p style={{ fontSize: '7pt', color: MUTED }}>{quoteNum}</p>
          </div>

        </div>
      </div>
    </>
  )
}
