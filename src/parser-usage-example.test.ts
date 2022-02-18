
import { number } from "fp-ts";
import { alt, any, bind, char, choice, Context, eof, Failure, failure, fmap, many1, mapFailure, moveIndex, Parser, Result, satisfy, satisfyA, sequential2, sequential2b, sequential3, sequential4, success, tryParse, unit } from "./parsers";

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




// 'cups'
const cupsParser: Parser<string> = satisfyA<string>('expected "cups"')(wordParser)(w => w === 'cups');
// 'grams'
const gramsParser: Parser<string> = satisfyA<string>('not grams')(wordParser)(w => w === 'grams');
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
    unit: string
}

interface Ingredient {
    measurement: Measurement,
    ingredient: string
}

const measurementParserA: Parser<[number, string[], string]> = sequential3(numberParser, whiteSpaceParser, measureParser)
// measurement: number whitespace unit
const measurementParser: Parser<Measurement> = tryParse(fmap((x: [number, string[], string]) => ({ amount: x[0], unit: x[2] }))(measurementParserA));

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
    expect(cupsParser(ctx)).toEqual(failure(ctx, 'expected "cups"; actual: "123def"; index=0'))
  })

  test('cups parser success', () => {
    const ctx = { text: "cups abc", index: 0 };
    expect(cupsParser(ctx)).toEqual(success(moveIndex(ctx, 4), "cups"))
  })


  test ('10 cups', () => {
    const ctx = { text: "10 cups abc", index: 0 };

    const result: Measurement = {amount: 10, unit: 'cups'};
    expect (measurementParser(ctx)).toEqual(success(moveIndex(ctx, 7), result));

  })
  test ('not 10 cups', () => {
    const ctx = { text: "10 ", index: 0 };

    const result: Measurement = {amount: 10, unit: 'cups'};
    expect (measurementParser(ctx)).toEqual(failure(ctx, 'not a measurement'));

  })
  test ('10 cups only', () => {
    const ctx = { text: "10 cups", index: 0 };

    const result: Measurement = {amount: 10, unit: 'cups'};
    expect (measurementParser(ctx)).toEqual(success(moveIndex(ctx, 7), result));
  })


  test ('10 cups water', () => {
    const ctx = { text: "10 cups water abc", index: 0 };

    const expected: Ingredient = {measurement: {amount: 10, unit: 'cups'}, ingredient: 'water'};

    const result: Result<Ingredient> = ingredientParser(ctx);
    expect(result).toEqual(success(moveIndex(ctx, 13), expected));
  })


  test ('10 cups water then eof', () => {
    const ctx = { text: "10 cups water", index: 0 };

    const testParser: Parser<[Ingredient, unit]> = sequential2(ingredientParser, eof);

    const result: Ingredient = {measurement: {amount: 10, unit: 'cups'}, ingredient: 'water'};
    expect (testParser(ctx)).toEqual(success(moveIndex(ctx, 13), [result, {}]));
  })
})

// Messing around with measurement types.
type measureType = 'cup' | 'kg' | 'gram';
const measuresKeyValue: [measureType, string[]][] = 
[
  ['cup', ['cup', 'cups']],
  ['kg', ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms']],
  ['gram', ['gram', 'grams']]
];

const getMeasurementParsers = (measureType: measureType, measures: string[]): Parser<measureType> => {
  const parsers: Parser<string>[] =
    measures.map(s =>
      satisfyA<string>(`expected ${s}`)(wordParser)(w => w === s)
    )
  const result: Parser<measureType>[] =
    parsers.map(p => fmap(_s => measureType)(p));
  const newResult = choice(`expected ${measureType.toString()}`, result)
  return newResult;
}

const measureTypeParser = (dataIn: [measureType, string[]][]): Parser<measureType> => {
  const parsers: Parser<measureType>[] = 
    dataIn.map(x => getMeasurementParsers(x[0], x[1]));
  const measurementParser: Parser<measureType> = choice('expected measureType', parsers)
  const m2: Parser<measureType> =
    mapFailure<measureType>
      ((f: Failure) => failure(f.ctx, `${f.expected}; index=${f.ctx.index}`))
      (measurementParser);
  return m2;
}

const x = measuresKeyValue.flatMap(x => x[1].map(a => [a, x[0]]))


describe('measureType parsers', () => {
  test('numberParser', () => {
    const parser = measureTypeParser(measuresKeyValue);
    const ctx = { text: "cup abc", index: 0 };
    expect(parser(ctx)).toEqual(success(moveIndex(ctx, 3), 'cup'))
  })

  test('numberParser', () => {
    const parser = measureTypeParser(measuresKeyValue);
    const ctx = { text: "cups abc", index: 0 };
    expect(parser(ctx)).toEqual(success(moveIndex(ctx, 4), 'cup'))
  })

  test('numberParser', () => {
    const parser = measureTypeParser(measuresKeyValue);
    const ctx = { text: "cupx abc", index: 0 };
    expect(parser(ctx)).toEqual(failure(ctx, "expected measureType; index=0"));
  })
})

