// FIXME: implement some interface?

import type {
  INGVSearchProvider,
  INGVSearchResult,
} from '../../interfaces/search/ingv-search-provider.js';

// FIXME: only expose the search function?
export const provider: INGVSearchProvider = {
  search(_text: string, _lang: string): Promise<INGVSearchResult[]> {
    const fake: INGVSearchResult[] = [
      {
        title: 'Lausanne',
        geom: {
          type: 'Point',
          coordinates: [6.631643, 46.52135],
        },
      },
    ];
    return Promise.resolve(fake);
  },
};
