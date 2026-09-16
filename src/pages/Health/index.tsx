export default function HealthPage() {
  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <p><strong>status:</strong> ok</p>
      <p><strong>app:</strong> MYD3000 Admin</p>
      <p><strong>version:</strong> 1.0.0</p>
      <p><strong>timestamp:</strong> {new Date().toISOString()}</p>
    </div>
  )
}
