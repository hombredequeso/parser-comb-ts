import { boolean } from "fp-ts";

// we should make this immutable, because we can.
type Context = Readonly<{
  text: string; // the full input string
  index: number; // our current position in it
}>;

const moveIndex = (ctx: Context, count: number) => (
  {
    text: ctx.text,
    index: ctx.index + count
  });

// our result types
type Result<T> = Success<T> | Failure;


// on success we'll return a value of type T, and a new Ctx
// (position in the string) to continue parsing from
type Success<T> = Readonly<{
  success: true;
  value: T;
  ctx: Context;
}>;

// when we fail we want to know where and why
type Failure = Readonly<{
  success: false;
  expected: string;
  ctx: Context;
}>;

// every parsing function will have this signature
type Parser<T> = (ctx: Context) => Result<T>;


// some convenience methods to build `Result`s for us
const success: <T>(ctx: Context, value: T) => Success<T> = <T>(ctx: Context, value: T): Success<T> => {
  return { success: true, value, ctx };
}

const failure = (ctx: Context, expected: string): Failure => {
  return { success: false, expected, ctx };
}


type char = string
const any: Parser<char> = (ctx: Context) =>
  (ctx.text.length > ctx.index)
    ? success(moveIndex(ctx, 1), ctx.text[ctx.index])
    : failure(ctx, "expected char; end of input")


type unit = {}
const eof: Parser<unit> = (ctx: Context) =>
  ctx.text.length === ctx.index
    ? success(ctx, {})
    : failure(ctx, "not eof")


// Functor

const fmap = <A, B>(f: (a: A) => B) => (p: Parser<A>) => (ctx: Context) => {
  const a: Result<A> = p(ctx);
  return a.success ?
    success(a.ctx, f(a.value)) :
    a;
}

const mapFailure = <A>(f: (f: Failure) => Failure) => (p: Parser<A>) => 
(ctx: Context) => {
  const a: Result<A> = p(ctx);
  return a.success
  ? a
  : f(a)
}

const mapFailureString = <A>(err: string, parser: Parser<A>): Parser<A> =>
  mapFailure<A>((f: Failure) => failure(f.ctx, err))(parser)

// Applicative

const pure = <T>(t: T) => (ctx: Context) => success(ctx, t)


// Monad

const bind = <A, B>(parserA: Parser<A>, f: (a: A) => Parser<B>): Parser<B> =>
  (ctx: Context) => {
    const resultA: Result<A> = parserA(ctx);
    const resultB: Result<B> = resultA.success ?
      f(resultA.value)(resultA.ctx) :
      resultA;
    return resultB;
  }

const tryParse = <A>(parser: Parser<A>) => (ctx: Context) => {
  const a = parser(ctx);
  return a.success
    ? a
    : failure(ctx, (a as Failure).expected);
}

// Use tryParse to run the Parser, but if isn't what we want then backtrack.
const satisfy = (errMsg: string) => (predicate: (c: char) => boolean) => tryParse(
  (ctx: Context) => {
    const anyResult = any(ctx);
    return anyResult.success
      ? (predicate(anyResult.value) ? anyResult : failure(ctx, errMsg))
      : anyResult;
  }
);


// Using monadic type operations to run sequences of parsers

// Different ways of doing the same thing:
// 2:

const sequential2c = <A, B>(parserA: Parser<A>, parserB: Parser<B>): Parser<[A, B]> =>
  bind(parserA, a => fmap<B, [A, B]>((b) => [a, b])(parserB));

const sequential2 = <A, B>(parserA: Parser<A>, parserB: Parser<B>): Parser<[A, B]> =>
  bind(parserA, a => (ctx: Context) => {
    const result = parserB(ctx);
    return result.success
      ? success<[A, B]>(result.ctx, [a, result.value])
      : result;
  });

// 3:

const extendTuple = <A, B, C>(a: [A, B], c: C): [A, B, C] => [a[0], a[1], c]
const sequential3d  = <A, B, C>(parserA: Parser<A>, parserB: Parser<B>, parserC: Parser<C>): Parser<[A, B, C]> => 
  bind(sequential2c(parserA, parserB), (a: [A, B]) => fmap<C, [A,B,C]>((c: C) => [a[0], a[1], c])(parserC));

const sequential3b = <A, B, C>(parserA: Parser<[A, B]>, parserC: Parser<C>): Parser<[A, B, C]> =>
  bind(parserA, (a: [A, B]) => (ctx: Context) => {
    const result = parserC(ctx);
    return result.success
      ? success<[A, B, C]>(result.ctx, extendTuple(a, result.value))
      : result;
  });
const sequential3 = <A, B, C>(parserA: Parser<A>, parserB: Parser<B>, parserC: Parser<C>): Parser<[A, B, C]> =>
  sequential3b(sequential2(parserA, parserB), parserC);


// 4:


const extendTuple4 = <A, B, C, D>(a: [A, B, C], d: D): [A, B, C, D] => [a[0], a[1], a[2], d]
const sequential4b = <A, B, C, D>(parserA: Parser<[A, B, C]>, parserD: Parser<D>): Parser<[A, B, C, D]> =>
  bind(parserA, (a: [A, B, C]) => (ctx: Context) => {
    const result = parserD(ctx);
    return result.success
      ? success<[A, B, C, D]>(result.ctx, extendTuple4(a, result.value))
      : result;
  });


const sequential4 = <A, B, C, D>(parserA: Parser<A>, parserB: Parser<B>, parserC: Parser<C>, parserD: Parser<D>): Parser<[A, B, C, D]> =>
  sequential4b(sequential3(parserA, parserB, parserC), parserD);


// Or type operations

const alt = <A>(parser1: Parser<A>, parser2: Parser<A>): Parser<A> =>
  (ctx: Context) => {
    const parser1Result = parser1(ctx);
    if (parser1Result.success) {
      return parser1Result;
    }
    if (parser1Result.ctx.index == ctx.index) {
      return parser2(ctx);
    }
    return parser1Result;
  }

const errorParser = <A>(errMsg: string): Parser<A> => (ctx: Context) => failure(ctx, errMsg);

const choice = <A>(err: string, parsers: Parser<A>[]) => parsers.reduce((a, b) => alt(b, a), errorParser(err))


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

  const xSpace7Parser = (xParser: Parser<char>, spaceParser: Parser<char>, sevenParser: Parser<number>): Parser<string> => {
    return tryParse(bind(xParser, (xChar: char) => (ctx: Context) => {
      const spaceResult = spaceParser(ctx);
      if (spaceResult.success) {
        const sevenResult = sevenParser(spaceResult.ctx);
        if (sevenResult.success) {
          return success(sevenResult.ctx, xChar + sevenResult.value.toString())
        }
      }
      return failure(ctx, "wrong")
    }));
  }
})



describe('messin with monadic style', () => {


  test('fails when not parserA', () => {
    const ctx = { text: "abc", index: 0 };
    const xParser: Parser<char> = satisfy('not x')(isX)
    const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
    const xThenDigitParser: Parser<[char, number]> = sequential2(xParser, digitParser);

    expect(xThenDigitParser(ctx)).toEqual(failure(ctx, 'not x'));
  })

  test('fails when not parserB, but parserA succeeds', () => {
    const ctx = { text: "xbc", index: 0 };
    const xParser: Parser<char> = satisfy('not x')(isX)
    const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
    const xThenDigitParser: Parser<[char, number]> = sequential2(xParser, digitParser);

    expect(xThenDigitParser(ctx)).toEqual(failure(moveIndex(ctx, 1), 'not digit'));
  })



  describe('sequential2c', () => {
    test('when not parserA', () => {
      const ctx = { text: "abc", index: 0 };
      const xParser: Parser<char> = satisfy('not x')(isX)
      const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
      const xThenDigitParser: Parser<[char, number]> = sequential2c(xParser, digitParser);

      expect(xThenDigitParser(ctx)).toEqual(failure(ctx, "not x"));
    })

    test('fails when not parserB, but parserA succeeds', () => {
      const ctx = { text: "xbc", index: 0 };
      const xParser: Parser<char> = satisfy('not x')(isX)
      const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))
      const xThenDigitParser: Parser<[char, number]> = sequential2c(xParser, digitParser);

      expect(xThenDigitParser(ctx)).toEqual(failure(moveIndex(ctx, 1), "not digit"));
    })
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
