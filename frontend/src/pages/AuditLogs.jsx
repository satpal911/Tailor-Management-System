import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import api from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { date, errorMessage } from '../utils/constants.js';
import { Loading, PageHeader } from '../components/UI.jsx';

export default function AuditLogs() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    api
      .get('/audit-logs', { params: { limit: 100 } })
      .then((response) => setRows(response.data.data || []))
      .catch((error) => toast(errorMessage(error), 'error'))
      .finally(() => setBusy(false));
  }, [toast]);
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTABILITY"
        title="Audit log"
        subtitle="Administrative and staff actions recorded by the system."
      />
      {busy ? (
        <Loading />
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>ACTOR</th>
                  <th>ACTION</th>
                  <th>RECORD</th>
                  <th>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>{date(row.createdAt)}</td>
                    <td>
                      {row.actor?.name || 'System'}
                      <small>{row.actor?.role}</small>
                    </td>
                    <td>
                      <Activity size={14} /> {row.action}
                    </td>
                    <td>{row.entity}</td>
                    <td>
                      {Object.entries(row.metadata || {})
                        .map(([key, value]) => `${key}: ${String(value)}`)
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="empty-state">
                <b>No audit events yet</b>
                <span>Important administrative actions will appear here.</span>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
