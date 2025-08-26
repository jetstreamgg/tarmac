export function capitalizeFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncateStringToFourDecimals(str: string) {
  const decimalIndex = str.indexOf('.');
  const decimalDigits = 4;

  if (decimalIndex === -1) {
    return str;
  }

  return str.substring(0, decimalIndex + decimalDigits + 1);
}
