// Коннектор VK (наш чистый код, по официальному VK API, v5.199).
// token = access_token с правами wall,photos; target_id = id группы (owner_id = -group_id).
// Фото: photos.getWallUploadServer → upload → photos.saveWallPhoto → wall.post(attachments).
import type { Connector, Connection, PublishInput, PublishResult, ConnectionCheck } from './types';

const V = '5.199';

async function vkCall(method: string, params: Record<string, string>): Promise<any> {
  const usp = new URLSearchParams({ ...params, v: V });
  const res = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: usp.toString(),
  });
  const json = await res.json();
  if (json.error) throw new Error(`VK ${method}: ${json.error.error_msg}`);
  return json.response;
}

// Загрузка одного фото на стену группы → attachment-строка "photo{owner}_{id}".
async function uploadPhoto(token: string, ownerId: string, imageUrl: string): Promise<string> {
  const server = await vkCall('photos.getWallUploadServer', { access_token: token, group_id: ownerId.replace('-', '') });
  const img = await (await fetch(imageUrl)).blob();
  const fd = new FormData();
  fd.append('photo', img, 'post.jpg');
  const up = await (await fetch(server.upload_url, { method: 'POST', body: fd })).json();
  const saved = await vkCall('photos.saveWallPhoto', {
    access_token: token, group_id: ownerId.replace('-', ''),
    server: String(up.server), photo: up.photo, hash: up.hash,
  });
  const p = saved[0];
  return `photo${p.owner_id}_${p.id}`;
}

export const vkConnector: Connector = {
  platform: 'vk',
  maxLength: 2048,

  async check(conn: Connection): Promise<ConnectionCheck> {
    try {
      const g = await vkCall('groups.getById', { access_token: conn.token, group_id: String(conn.target_id).replace('-', '') });
      const name = g?.[0]?.name || g?.groups?.[0]?.name || conn.target_id;
      return { ok: true, info: `Группа «${name}»` };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  },

  async publish(conn: Connection, input: PublishInput): Promise<PublishResult> {
    try {
      const ownerId = `-${String(conn.target_id).replace('-', '')}`; // стена группы = отрицательный id
      const attachments: string[] = [];
      for (const m of (input.media || []).filter((x) => x.type === 'image')) {
        attachments.push(await uploadPhoto(conn.token, ownerId, m.url));
      }
      const params: Record<string, string> = {
        access_token: conn.token,
        owner_id: ownerId,
        from_group: '1',
        message: (input.text || '').slice(0, this.maxLength),
      };
      if (attachments.length) params.attachments = attachments.join(',');
      const r = await vkCall('wall.post', params);
      const postId = String(r.post_id);
      return { ok: true, postId, url: `https://vk.com/wall${ownerId}_${postId}` };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  },
};
