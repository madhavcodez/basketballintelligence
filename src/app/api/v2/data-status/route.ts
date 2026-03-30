import { getPlayoffDataStatus } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export async function GET() {
  try {
    const status = getPlayoffDataStatus();
    return jsonWithCache({
      regular: true,
      playoffs: status.hasPlayoffStats || status.hasPlayoffShots,
      playoffSeasons: status.playoffSeasons,
      details: status,
    }, 300);
  } catch (e) {
    return handleApiError(e, 'v2-data-status');
  }
}
