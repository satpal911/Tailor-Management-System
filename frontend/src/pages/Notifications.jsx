import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { date, errorMessage } from '../utils/constants.js';
import { Button, Loading, PageHeader } from '../components/UI.jsx';
export default function Notifications() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [showRead, setShowRead] = useState(false);
  const [marking, setMarking] = useState('');
  async function load() {
    try {
      const { data } = await api.get('/notifications', {
        params: showRead ? undefined : { unread: true },
      });
      const notifications = data.data || [];
      setRows(notifications);
      window.dispatchEvent(
        new CustomEvent('notifications:unread-count', {
          detail: {
            count:
              data.meta?.unreadCount ??
              notifications.filter((notification) => !notification.readAt).length,
          },
        }),
      );
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener('notifications:refresh', refresh);
    return () => window.removeEventListener('notifications:refresh', refresh);
  }, [showRead]);
  async function mark(id) {
    setMarking(id);
    try {
      await api.patch(`/notifications/${id}/read`);
      await load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setMarking('');
    }
  }
  async function all() {
    try {
      await api.patch('/notifications/read-all');
      toast('All caught up');
      await load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="A NOTE FROM YOUR ATELIER"
        title="Notifications"
        subtitle="Order updates and little things worth knowing."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowRead((value) => !value)}>
            {showRead ? 'Show unread' : 'Show all'}
          </Button>
          {!showRead && rows.length > 0 && (
            <Button variant="outline" onClick={all} icon={CheckCheck}>
              Mark all read
            </Button>
          )}
        </div>
      </PageHeader>
      {busy ? (
        <Loading />
      ) : (
        <div className="notification-list">
          {rows.map((n) => (
            <article key={n._id} className={`card notification-row ${n.readAt ? 'is-read' : ''}`}>
              <i>
                <Bell size={15} />
              </i>
              <div>
                <b>{n.title}</b>
                <p>{n.message}</p>
                <small>
                  {date(n.createdAt)} · {n.type.toLowerCase()}
                </small>
              </div>
              {!n.readAt && (
                <button disabled={marking === n._id} onClick={() => mark(n._id)}>
                  {marking === n._id ? 'Saving…' : 'Mark read'}
                </button>
              )}
            </article>
          ))}
          {!rows.length && (
            <div className="card empty-state">
              <b>All quiet here</b>
              <span>New order and payment updates will appear here.</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
