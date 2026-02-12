/**
 * Russian pluralization helper.
 *
 * @example
 *   pluralizeRu(1, 'слово', 'слова', 'слов')  // '1 слово'
 *   pluralizeRu(3, 'слово', 'слова', 'слов')  // '3 слова'
 *   pluralizeRu(5, 'слово', 'слова', 'слов')  // '5 слов'
 */
export function pluralizeRu(count: number, one: string, few: string, many: string): string {
    const abs = Math.abs(count);
    const mod10 = abs % 10;
    const mod100 = abs % 100;

    if (mod100 >= 11 && mod100 <= 19) {
        return `${count} ${many}`;
    }
    if (mod10 === 1) {
        return `${count} ${one}`;
    }
    if (mod10 >= 2 && mod10 <= 4) {
        return `${count} ${few}`;
    }
    return `${count} ${many}`;
}
