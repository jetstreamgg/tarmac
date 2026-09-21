import { useEffect, useState } from 'react';
import { formatDate, getDateLocale } from '../../utils/formatDate';

const formatDatesArray = async (dates: Date[], locale?: string, format?: string) => {
  const dateLocale = await getDateLocale(locale || '');

  return dates.map((date: Date) => {
    return formatDate(date, dateLocale, format);
  });
};

export const useFormatDates = (dates?: Date[], locale?: string, format?: string) => {
  const [formatted, setFormatted] = useState<string[]>([]);

  useEffect(() => {
    // A locale whose chunk is cached can resolve before an earlier uncached
    // one, so a superseded run must not write its result.
    let ignore = false;
    const fetchFormattedDates = async () => {
      if (dates) {
        const next = await formatDatesArray(dates, locale, format);
        if (!ignore) setFormatted(next);
      }
    };

    fetchFormattedDates();
    return () => {
      ignore = true;
    };
  }, [dates, locale, format]);

  return formatted;
};
