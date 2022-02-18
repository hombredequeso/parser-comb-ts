
// we should make this immutable, because we can.
export type Context = Readonly<{
  text: string; // the full input string
  index: number; // our current position in it
}>;

export const moveIndex = (ctx: Context, count: number) => (
  {
    text: ctx.text,
    index: ctx.index + count
  });

// our result types
export type Result<T> = Success<T> | Failure;


// on success we'll return a value of type T, and a new Ctx
// (position in the string) to continue parsing from
export type Success<T> = Readonly<{
  success: true;
  value: T;
  ctx: Context;
}>;

// when we fail we want to know where and why
export type Failure = Readonly<{
  success: false;
  expected: string;
  ctx: Context;
}>;

// every parsing function will have this signature
export type Parser<T> = (ctx: Context) => Result<T>;


// some convenience methods to build `Result`s for us
export const success: <T>(ctx: Context, value: T) => Success<T> = <T>(ctx: Context, value: T): Success<T> => {
  return { success: true, value, ctx };
}

export const failure = (ctx: Context, expected: string): Failure => {
  return { success: false, expected, ctx };
}

// Most basic parsers:

// Parse any character at all. Only fails if the end of the file is reached.
export type char = string
export const any: Parser<char> = (ctx: Context) =>
  (ctx.text.length > ctx.index)
    ? success(moveIndex(ctx, 1), ctx.text[ctx.index])
    : failure(ctx, "expected char; end of input")


// Parse the end-of-file. Succeeds when at the end.
export type unit = {}
export const eof: Parser<unit> = (ctx: Context) =>
  ctx.text.length === ctx.index
    ? success(ctx, {})
    : failure(ctx, "not eof")


// The major functional typeclasses:

// Functor

// Perhaps more commonly known as 'map'.
export const fmap = <A, B>(f: (a: A) => B) => (p: Parser<A>) => (ctx: Context) => {
  const a: Result<A> = p(ctx);
  return a.success ?
    success(a.ctx, f(a.value)) :
    a;
}

// Amounting to 'mapLeft'.
export const mapFailure = <A>(f: (f: Failure) => Failure) => (p: Parser<A>) => 
(ctx: Context) => {
  const a: Result<A> = p(ctx);
  return a.success
  ? a
  : f(a)
}

export const mapFailureString = <A>(err: string, parser: Parser<A>): Parser<A> =>
  mapFailure<A>((f: Failure) => failure(f.ctx, err))(parser)

// Applicative
// These aren't really required, however, are implemented out of curiosity.

export const pure = <T>(t: T) => (ctx: Context) => success(ctx, t);

export const apply = <A,B>(parserf: Parser<(a:A) => B>, parserA: Parser<A>): Parser<B> => 
    (ctx: Context) => {
      const f: Result<(a:A)=>B> = parserf(ctx);
      return f.success
        ? fmap((a:A) => f.value(a))(parserA)(f.ctx)
        : f;
    }

export const applyInLongForm = <A,B>(parserf: Parser<(a:A) => B>, parserA: Parser<A>): Parser<B> => 
    (ctx: Context) => {
        const x: Result<(a:A) => B> = parserf(ctx)
        if (x.success) {
            const a: Result<A> = parserA(x.ctx);
            if (a.success) {
                const result: Result<B> =  success(a.ctx, x.value(a.value))
                return result;
            } else {
                return a;
            }
        }
        return x;
    }

// Monad
// Be very afraid... :-) 

// Variously known as bind, flatMap, chain (in fp-ts)
export const bind = <A, B>(parserA: Parser<A>, f: (a: A) => Parser<B>): Parser<B> =>
  (ctx: Context) => {
    const resultA: Result<A> = parserA(ctx);
    const resultB: Result<B> = resultA.success ?
      f(resultA.value)(resultA.ctx) :
      resultA;
    return resultB;
  }


// Take a parser, and if it fails, restore the original context - most notably including the
// context's parsing index.
export const tryParse = <A>(parser: Parser<A>) => (ctx: Context) => {
  const a = parser(ctx);
  return a.success
    ? a
    : failure(ctx, (a as Failure).expected);
}

// Use tryParse to run the Parser, but if isn't what we want then backtrack.
export const satisfy = (errMsg: string) => (predicate: (c: char) => boolean) => tryParse(
  (ctx: Context) => {
    const anyResult = any(ctx);
    return anyResult.success
      ? (predicate(anyResult.value) 
        ? anyResult 
        : failure(anyResult.ctx, `${errMsg}; actual: "${anyResult.value}"; index=${ctx.index}`))
      : anyResult;
  }
);

// Same as satisfy, but for things other than characters.
// Given a Parser<A>, tests 'A' with predicate to determine success or failure.
export const satisfyA = <A>(errMsg: string) => (parser: Parser<A>) => (predicate: (a: A) => boolean): Parser<A> => tryParse(
  (ctx: Context) => {
    const anyResult = parser(ctx);
    return anyResult.success
      ? (predicate(anyResult.value)
        ? anyResult
        : failure(ctx, `${errMsg}; actual: "${anyResult.value}"; index=${ctx.index}`))
      : anyResult;
  }
);

// Using monadic type operations to run sequences of parsers
// 'Do' notation isn't built into Javascript/Typescript (although can be emulated: https://gcanti.github.io/fp-ts/guides/do-notation.html)

// Primary use case is stringing one Parser after another.
// So use monadic bind to return tuples of results from running one parser after another:

export const sequential2 = <A, B>(parserA: Parser<A>, parserB: Parser<B>): Parser<[A, B]> =>
  bind(parserA, a => fmap<B, [A, B]>((b) => [a, b])(parserB));

export const sequential2b = <A, B>(parserA: Parser<A>, parserB: Parser<B>): Parser<[A, B]> =>
  bind(parserA, a => (ctx: Context) => {
    const result = parserB(ctx);
    return result.success
      ? success<[A, B]>(result.ctx, [a, result.value])
      : result;
  });

// 3:

export const extendTuple2 = <A, B, C>(a: [A, B], c: C): [A, B, C] => [a[0], a[1], c]
export const sequential3  = <A, B, C>(parserA: Parser<A>, parserB: Parser<B>, parserC: Parser<C>): Parser<[A, B, C]> => 
  bind(sequential2(parserA, parserB), (a: [A, B]) => fmap<C, [A,B,C]>((c: C) => extendTuple2(a,c))(parserC));

export const sequential3b = <A, B, C>(parserA: Parser<[A, B]>, parserC: Parser<C>): Parser<[A, B, C]> =>
  bind(parserA, (a: [A, B]) => (ctx: Context) => {
    const result = parserC(ctx);
    return result.success
      ? success<[A, B, C]>(result.ctx, extendTuple2(a, result.value))
      : result;
  });
export const sequential3c = <A, B, C>(parserA: Parser<A>, parserB: Parser<B>, parserC: Parser<C>): Parser<[A, B, C]> =>
  sequential3b(sequential2b(parserA, parserB), parserC);


// 4:

export const extendTuple3 = <A, B, C, D>(a: [A, B, C], d: D): [A, B, C, D] => [a[0], a[1], a[2], d]
export const sequential4 = <A, B, C, D>(parserA: Parser<A>, parserB: Parser<B>, parserC: Parser<C>, parserD: Parser<D>): Parser<[A, B, C, D]> =>
  bind(sequential3(parserA, parserB, parserC), (a: [A,B,C]) => fmap<D, [A,B,C,D]>((d:D) => extendTuple3(a, d))(parserD));

export const sequential4b = <A, B, C, D>(parserA: Parser<[A, B, C]>, parserD: Parser<D>): Parser<[A, B, C, D]> =>
  bind(parserA, (a: [A, B, C]) => (ctx: Context) => {
    const result = parserD(ctx);
    return result.success
      ? success<[A, B, C, D]>(result.ctx, extendTuple3(a, result.value))
      : result;
  });

export const extendTuple4 = <A, B, C, D, E>(a: [A, B, C, D], e: E): [A, B, C, D, E] => [a[0], a[1], a[2], a[3], e]
export const sequential5 = <A, B, C, D, E>(parserA: Parser<A>, parserB: Parser<B>, parserC: Parser<C>, parserD: Parser<D>, parserE: Parser<E>): Parser<[A, B, C, D, E]> =>
  bind(sequential4(parserA, parserB, parserC, parserD), (a: [A,B,C,D]) => fmap<E, [A,B,C,D,E]>((e:E) => extendTuple4(a, e))(parserE));


// Or type operations

export const alt = <A>(parser1: Parser<A>, parser2: Parser<A>): Parser<A> =>
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

export const errorParser = <A>(errMsg: string): Parser<A> => (ctx: Context) => failure(ctx, errMsg);

export const choice = <A>(err: string, parsers: Parser<A>[]) => parsers.reduce((a, b) => alt(b, a), errorParser(err))

export const prepend = <A>(a: A, as: A[]): A[] => [a].concat(as);

// match 0 or more
export const many = <A>(parser: Parser<A>): Parser<A[]> => (ctx: Context) => {
  const result = parser(ctx);
  if (result.success) {
    const r2: Parser<A[]> = many(parser)
    const executed: Result<A[]> = r2(result.ctx);
    if (executed.success) {
      return success(executed.ctx, prepend(result.value, executed.value))
    } else {
      return success(executed.ctx, [result.value]);
    }
  }
  return success(ctx, []);
}


// match 1 or more
export const many1 = <A>(parser: Parser<A>): Parser<A[]> =>
  bind(parser, (a: A): Parser<A[]> => fmap((as: A[]) => prepend(a, as))(many(parser)));

const addToParser = <A>(prev: Parser<A[]>, curr: Parser<A>) =>
    fmap((x: [A[],A]) => x[0].concat([x[1]]))(sequential2(prev, curr));

// Of the traversable variety.
const sequence = <A>(parsers: Parser<A>[]): Parser<A[]> => {
    const emptyParser: Parser<A[]> = (ctx: Context) => success<A[]>(ctx, []);
    const result: Parser<A[]> = parsers.reduce(addToParser, emptyParser)
    return result;
}