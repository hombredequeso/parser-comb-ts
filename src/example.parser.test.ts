
import { number } from "fp-ts";
import { alt, any, bind, char, choice, Context, eof, failure, fmap, many1, moveIndex, Parser, Result, satisfy, sequential2, sequential2b, sequential3, sequential4, success, tryParse, unit } from "./parsers";

// 10 cups water
// 3grams tea


const isDigit = (c: char) => (c >= '0' && c <= '9');
const isSpace = (c: char) => (c === ' ');
const notSpace = (c: char) => !isSpace(c);

// Anything that's not whitespace
const nonWhitespaceParser: Parser<char> = satisfy('is whitespace')(notSpace);
const lettersParser: Parser<char[]> = many1(nonWhitespaceParser);

// word: sequence of characters that is not whitespace
const wordParser: Parser<string> = fmap((cs: char[]) => cs.join(''))(lettersParser);
const spaceParser: Parser<char> = satisfy('not whitespace')(isSpace);
const whiteSpaceParser: Parser<string[]> = many1(spaceParser);


export const satisfyGeneral = <A>(errMsg: string) => (parser: Parser<A>) => (predicate: (a: A) => boolean): Parser<A> => tryParse(
  (ctx: Context) => {
    const anyResult = parser(ctx);
    return anyResult.success
      ? (predicate(anyResult.value) ? anyResult : failure(ctx, errMsg))
      : anyResult;
  }
);

type measureType = 'cup' | 'kg' | 'gram';
const measureTransform: [string, measureType][] = [['cup', 'cup'], ['cups', 'cup'], ['kg', 'kg'], ['kilogram', 'kg'], ['kilos', 'kg']];
const toMeasureType: Map<string, measureType> = new Map(measureTransform);
const measureParsers2: Parser<string>[] = ['cup', 'cups', 'kg'].map(str => satisfyGeneral<string>("not ${str")(wordParser)(w => w === str));
const measureParsers3: Parser<measureType>[] = measureTransform.map(str => fmap(s => str[1])(satisfyGeneral<string>("not ${str[0]}")(wordParser)(w => w === str[0])));
// const measureParsers4: Parser<measureType>[] = measureParsers3.map(p => fmap<string, measureType>(str => toMeasureType.get(str))(p));
const measureParserB: Parser<string> = choice("not a measure", measureParsers2)

// 'cups'
const cupsParser: Parser<string> = satisfyGeneral<string>('not cups')(wordParser)(w => w === 'cups');
// 'grams'
const gramsParser: Parser<string> = satisfyGeneral<string>('not grams')(wordParser)(w => w === 'grams');
// measure = 'cups' || 'grams'
const measureParser = choice('not a measurement', [cupsParser, gramsParser]);



// Hey, hey, not very functional!
const digitsToNumber = (ds: number[]): number => {
    let total = 0;
    let multiplier= 1;
    for (let i = ds.length-1; i>=0; i--) {
        total = total + ds[i]*multiplier;
        multiplier = multiplier * 10;
    }
    return total;
}

// Any digit
const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit));

// Any natural number
const numberParser: Parser<number> = fmap(digitsToNumber)(many1(digitParser));

  interface Measurement {
      amount: number,
      ingredient: string
  }

  interface Ingredient {
      measurement: Measurement,
      ingredient: string
  }

const measurementParserA: Parser<[number, string[], string]> = sequential3(numberParser, whiteSpaceParser, measureParser)
// measurement: number whitespace meaure
const measurementParser: Parser<Measurement> = tryParse(fmap((x: [number, string[], string]) => ({ amount: x[0], ingredient: x[2] }))(measurementParserA));


  const ingredientParserA: Parser<[Measurement, string[], string]> = sequential3(measurementParser, whiteSpaceParser, wordParser);
  // ingredient: measurement whitespace word
  const ingredientParser: Parser<Ingredient> = tryParse(
      fmap<[Measurement, string[], string], Ingredient>(
          (x: [Measurement, string[], string]) => ({measurement: x[0], ingredient: x[2]}))
          (ingredientParserA));

describe('test parsers', () => {
  test('numberParser', () => {
    const ctx = { text: "123def", index: 0 };
    expect(numberParser(ctx)).toEqual(success(moveIndex(ctx, 3), 123))
  })

  test('cups parser failure', () => {
    const ctx = { text: "123def", index: 0 };
    expect(cupsParser(ctx)).toEqual(failure(ctx, 'not cups'))
  })

  test('cups parser success', () => {
    const ctx = { text: "cups abc", index: 0 };
    expect(cupsParser(ctx)).toEqual(success(moveIndex(ctx, 4), "cups"))
  })


  test ('10 cups', () => {
    const ctx = { text: "10 cups abc", index: 0 };

    const result: Measurement = {amount: 10, ingredient: 'cups'};
    expect (measurementParser(ctx)).toEqual(success(moveIndex(ctx, 7), result));

  })
  test ('not 10 cups', () => {
    const ctx = { text: "10 ", index: 0 };

    const result: Measurement = {amount: 10, ingredient: 'cups'};
    expect (measurementParser(ctx)).toEqual(failure(ctx, 'not a measurement'));

  })
  test ('10 cups only', () => {
    const ctx = { text: "10 cups", index: 0 };

    const result: Measurement = {amount: 10, ingredient: 'cups'};
    expect (measurementParser(ctx)).toEqual(success(moveIndex(ctx, 7), result));
  })


  test ('10 cups water', () => {
    const ctx = { text: "10 cups water abc", index: 0 };

    const result: Ingredient = {measurement: {amount: 10, ingredient: 'cups'}, ingredient: 'water'};
    expect (ingredientParser(ctx)).toEqual(success(moveIndex(ctx, 13), result));
  })


  test ('10 cups water then eof', () => {
    const ctx = { text: "10 cups water", index: 0 };

    const testParser: Parser<[Ingredient, unit]> = sequential2(ingredientParser, eof);

    const result: Ingredient = {measurement: {amount: 10, ingredient: 'cups'}, ingredient: 'water'};
    expect (testParser(ctx)).toEqual(success(moveIndex(ctx, 13), [result, {}]));
  })
})
