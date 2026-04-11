import { getTeams } from '@/lib/db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export async function GET() {
  try {
    const teams = getTeams();
    return jsonWithCache(teams, 300);
  } catch (e) { return handleApiError(e, 'teams'); }
}
