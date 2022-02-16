import { alt, any, apply, bind, char, choice, Context, eof, failure, fmap, many, many1, moveIndex, Parser, Result, satisfy, sequential2, sequential2b, sequential3, sequential4, success, tryParse } from "./parsers";


describe('any', () => {
  test('fails when there are no characters', () => {
    const cxt = { text: "", index: 0 };
    const result = any(cxt);
    expect(result).toEqual(failure(cxt, "expected char; end of input"))
  })

  test('succeeds when there is characters', () => {
    const ctx = { text: "abc", index: 0 };
    const result = any(ctx);
    expect(any(ctx)).toEqual(success(moveIndex(ctx, 1), "a"))
  })
})


describe('eof', () => {
  test('fails when there are characters', () => {
    const ctx = { text: "abc", index: 0 };
    expect(eof(ctx)).toEqual(failure(ctx, "not eof"))
  })

  test('succeeds when there are no characters', () => {
    const ctx = { text: "", index: 0 };
    expect(eof(ctx)).toEqual(success(ctx, {}))
  })


  test('succeeds when at eof', () => {
    const ctx = { text: "abc", index: 3 };
    expect(eof(ctx)).toEqual(success(ctx, {}))
  })
})


const isX = (c: char) => c === 'x';
const isFullStop = (c: char) => c === '.';
const isDigit = (c: char) => (c >= '0' && c <= '9');

describe('satisfy', () => {
  test('fails when predicate not met', () => {
    const ctx = { text: "abc", index: 0 };
    expect(satisfy('not x')(isX)(ctx)).toEqual(failure(ctx, "not x"))
  })

  test('succeeds when predicate met', () => {
    const ctx = { text: "xabc", index: 0 };
    expect(satisfy('not x')(isX)(ctx)).toEqual(success(moveIndex(ctx, 1), 'x'));
  })
})

describe('fmap', () => {
  test('fails when not digit', () => {
    // const xParser: Parser<char> = satisfy('not x')(isX)
    const ctx = { text: "abc", index: 0 };
    const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
    expect(digitParser(ctx))
      .toEqual(failure(ctx, 'not digit'))
  })

  test('passes when digit', () => {
    // const xParser: Parser<char> = satisfy('not x')(isX)
    const ctx = { text: "7abc", index: 0 };
    const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
    expect(digitParser(ctx))
      .toEqual(success(moveIndex(ctx, 1), 7))
  })
})


describe('monadic bind', () => {
  test('fails when not digit', () => {
    const ctx = { text: "abc", index: 0 };
    const xParser: Parser<char> = satisfy('not x')(isX)
    const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
    const digitBinder = (x: char) => (ctx: Context) => {
      const result = digitParser(ctx);
      return result.success
        ? success<[char, number]>(result.ctx, [x, result.value])
        : result;
    };

    const result: Parser<[char, number]> = bind(xParser, digitBinder);
    expect(result(ctx))
      .toEqual(failure(ctx, 'not x'))
  })

  test('passes when digit', () => {
    const ctx = { text: "x7abc", index: 0 };
    const xParser: Parser<char> = satisfy('not x')(isX)
    const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
    const digitBinder = (x: char): Parser<[char, number]> => (ctx: Context) => {
      const result = digitParser(ctx);
      return result.success
        ? success<[char, number]>(result.ctx, [x, result.value])
        : result;
    };
    const digitBinder2 = (x: char): Parser<[char, number]> => fmap<number, [char, number]>((n: number) => [x, n])(digitParser);
    const xThenDigitParser: Parser<[char, number]> = bind(xParser, digitBinder2);
    expect(xThenDigitParser(ctx))
      .toEqual(success(moveIndex(ctx, 2), ['x', 7]))
  })

})



describe('messin with monadic style', () => {


  test('fails when not parserA', () => {
    const ctx = { text: "abc", index: 0 };
    const xParser: Parser<char> = satisfy('not x')(isX)
    const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
    const xThenDigitParser: Parser<[char, number]> = sequential2b(xParser, digitParser);

    expect(xThenDigitParser(ctx)).toEqual(failure(ctx, 'not x'));
  })

  test('fails when not parserB, but parserA succeeds', () => {
    const ctx = { text: "xbc", index: 0 };
    const xParser: Parser<char> = satisfy('not x')(isX)
    const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
    const xThenDigitParser: Parser<[char, number]> = sequential2b(xParser, digitParser);

    expect(xThenDigitParser(ctx)).toEqual(failure(moveIndex(ctx, 1), 'not digit'));
  })



})

  describe('sequential2', () => {

    const xParser: Parser<char> = satisfy('not x')(isX)
    const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
    const xThenDigitParser: Parser<[char, number]> = sequential2(xParser, digitParser);

    const sequential2TestData: [string, Context, Result<[string, number]>][] = [
      ["if parserA fails, parser fails", { text: "abc", index: 0 }, failure({ text: "abc", index: 0 }, "not x")],
      ["if parserB fails, parser fails", { text: "xbc", index: 0 }, failure({ text: "xbc", index: 1 }, "not digit")],
      ["if parserA/B succeed, parser succeeds", { text: "x7bc", index: 0 }, success({ text: "x7bc", index: 2 }, ['x', 7])]
    ];

    test.each(sequential2TestData
    )('%s', (testName: string, ctx: Context, expected: Result<[string, number]>) => {
      expect(xThenDigitParser(ctx)).toEqual(expected);
    })
  })

  describe('sequential3', () => {

    const xParser: Parser<char> = satisfy('not x')(isX)
    const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
    const fullStopParser: Parser<char> = satisfy('not fullstop')(isFullStop);
    const xDigitFullStopParser: Parser<[char, number, char]> = sequential3(xParser, digitParser,fullStopParser);

    const sequential3TestData: [string, Context, Result<[char, number, char]>][] = [
      ["if parserA fails, parser fails", { text: "abc", index: 0 }, failure({ text: "abc", index: 0 }, "not x")],
      ["if parserB fails, parser fails", { text: "xbc", index: 0 }, failure({ text: "xbc", index: 1 }, "not digit")],
      ["if parserC fails, parser fails", { text: "x7cd", index: 0 }, failure({ text: "x7cd", index: 2 }, "not fullstop")],
      ["if parserA/B/C succeed, parser succeeds", { text: "x7.c", index: 0 }, success({ text: "x7.c", index: 3 }, ['x', 7, '.'])]
    ];

    test.each(sequential3TestData
    )('%s', (testName: string, ctx: Context, expected: Result<[char, number, char]>) => {
      expect(xDigitFullStopParser(ctx)).toEqual(expected);
    })
  })


  describe('sequential4', () => {

    const xParser: Parser<char> = satisfy('not x')(isX)
    const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
    const fullStopParser: Parser<char> = satisfy('not fullstop')(isFullStop);
    const testParser: Parser<[char, number, char,number]> = sequential4(xParser, digitParser,fullStopParser, digitParser);

    const sequential4TestData: [string, Context, Result<[char, number, char, number]>][] = [
      ["if parserA fails, parser fails", { text: "abcde", index: 0 }, failure({ text: "abcde", index: 0 }, "not x")],
      ["if parserB fails, parser fails", { text: "xbcde", index: 0 }, failure({ text: "xbcde", index: 1 }, "not digit")],
      ["if parserC fails, parser fails", { text: "x7cde", index: 0 }, failure({ text: "x7cde", index: 2 }, "not fullstop")],
      ["if parserD fails, parser fails", { text: "x7.de", index: 0 }, failure({ text: "x7.de", index: 3 }, "not digit")],
      ["if parserA/B/C/D succeed, parser succeeds", { text: "x7.3e", index: 0 }, success({ text: "x7.3e", index: 4 }, ['x', 7, '.', 3])]
    ];

    test.each(sequential4TestData
    )('%s', (testName: string, ctx: Context, expected: Result<[char, number, char, number]>) => {
      expect(testParser(ctx)).toEqual(expected);
    })
  })

describe('alt', () => {
  test('fails when nothing matches', () => {
    const ctx = { text: "abc", index: 0 };
    const xParser: Parser<char> = satisfy('not x')(isX);
    const digitParser: Parser<char> = satisfy('not digit')(isDigit);

    const xOrDigit: Parser<char> = alt(xParser, digitParser);

    expect(xOrDigit(ctx))
      .toEqual(failure(ctx, "not digit"))
  })

  test('passes when first matches', () => {
    const ctx = { text: "xbc", index: 0 };
    const xParser: Parser<char> = satisfy('not x')(isX);
    const digitParser: Parser<char> = satisfy('not digit')(isDigit);

    const xOrDigit: Parser<char> = alt(xParser, digitParser);

    expect(xOrDigit(ctx))
      .toEqual(success(moveIndex(ctx, 1), 'x'))
  })

  test('passes when second matches', () => {
    const ctx = { text: "7bc", index: 0 };
    const xParser: Parser<char> = satisfy('not x')(isX);
    const digitParser: Parser<char> = satisfy('not digit')(isDigit);

    const xOrDigit: Parser<char> = alt(xParser, digitParser);

    expect(xOrDigit(ctx))
      .toEqual(success(moveIndex(ctx, 1), '7'))
  })


  test('fails when nothing matches', () => {
    const ctx = { text: "abc", index: 0 };
    const xParser: Parser<char> = satisfy('not x')(isX);
    const digitParser: Parser<char> = satisfy('not digit')(isDigit);
    const fullStopParser: Parser<char> = satisfy('not fullstop')(isFullStop);

    const anyOfParser: Parser<char> = choice("not x or digit or full stop", [xParser, digitParser, fullStopParser])

    expect(anyOfParser(ctx))
      .toEqual(failure(ctx, "not x or digit or full stop"))
  })
})


describe('many/many1', () => {
  test('fails when nothing matches', () => {
    const ctx = { text: "abc", index: 0 };
    const xParser: Parser<char> = satisfy('not x')(isX);

    expect(many(xParser)(ctx)).toEqual(success(ctx, []))
    expect(many1(xParser)(ctx)).toEqual(failure(ctx, 'not x'))
  }),


  test('succeeds something matches', () => {
    const ctx = { text: "xbc", index: 0 };
    const xParser: Parser<char> = satisfy('not x')(isX);

    expect(many(xParser)(ctx)).toEqual(success(moveIndex(ctx, 1), ['x']))
    expect(many1(xParser)(ctx)).toEqual(success(moveIndex(ctx, 1), ['x']))
  })

  test('succeeds many matches', () => {
    const ctx = { text: "123bc", index: 0 };
    const digitParser: Parser<char> = satisfy('not digit')(isDigit);

    expect(many(digitParser)(ctx)).toEqual(success(moveIndex(ctx, 3), ['1', '2', '3']))
    expect(many1(digitParser)(ctx)).toEqual(success(moveIndex(ctx, 3), ['1', '2', '3']))
  })
})

describe('apply', () => {

    const ctx = { text: "", index: 0 };
    const applyTestData: [string, Result<number>,Result<number>, Result<number>][] = [
      ["success + success = success", success({ text: "123", index: 1 }, 1), success({ text: "123", index: 2 }, 2), success({ text: "123", index: 2 }, 3)],
      ["success + failure = failure", success({ text: "1x3", index: 1 }, 1), failure({ text: "1x3", index: 1 }, ""), failure({ text: "1x3", index: 1 }, "")],
      ["failure + success = failure", failure({ text: "x12", index: 1 }, ""),success({ text: "x12", index: 2 }, 2), failure({ text: "x12", index: 1 }, '')],
      ["failure + failure = failure", failure({ text: "xy2", index: 1 }, ""),failure({ text: "xy2", index: 2 }, ''), failure({ text: "xy2", index: 1 }, '')],
    ];

    test.each(applyTestData
    )('%s', (testName: string, a: Result<number>,b: Result<number>, c: Result<number>) => {
      const aParser = (c: Context) => a;
      const bParser = (c: Context) => b;

      const f = (a: number) => (b: number) => a + b;
      const mappedFirstParam: Parser<(b:number)=>number> = fmap(f)(aParser)
      const appliedSecondParam: Parser<number> = apply(mappedFirstParam, bParser);

      expect(appliedSecondParam(ctx)).toEqual(c);
    })
})