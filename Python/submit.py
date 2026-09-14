# id: kx9tqp
MOD = 998244353

def countWays(s, start, step):
    n = len(s)
    ways = 0

    # try starting with 0 or 1
    for first in ['0', '1']:
        ok = True
        cur = first

        i = start
        while i < n:
            if s[i] != '?' and s[i] != cur:
                ok = False
                break
            cur = '1' if cur == '0' else '0'
            i += step

        if ok:
            ways += 1

    return ways


t = int(input())
for _ in range(t):
    n = int(input())
    s = input()

    evenWays = countWays(s, 0, 2)
    oddWays = countWays(s, 1, 2)

    print((evenWays * oddWays) % MOD)