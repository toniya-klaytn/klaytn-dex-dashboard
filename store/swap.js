import kep7 from "~/utils/smartcontracts/kep-7.json"
import pair from "~/utils/smartcontracts/pair.json"
import coinMarketCapService from "~/services/coinMarketCap"

export const state = () => ({
  tokensList: [],
  exchangeRateLoading: null,
  pairNotExist: false,
  slippagePercent: 0.5,
  computedToken: null,
  exchangeRateIntervalID: null,
  selectedTokens: {
    tokenA: null,
    tokenB: null,
  },
})

export const actions = {
  async getTokens({ commit }) {
    const tokens = await this.$axios.$get("api/list-tokens")

    const listTokens = tokens.map(async (token) => {
      const contract = this.$kaikas.createContract(token.address, kep7.abi)
      const name = await contract.methods.name().call()
      const symbol = await contract.methods.symbol().call()
      const balance = await contract.methods
        .balanceOf(this.$kaikas.address)
        .call()

      const resInfo = await this.$axios.$get(coinMarketCapService.tokenInfo, {
        params: { id: token.id },
      })

      const info = resInfo.data[token.id]

      return {
        id: token.id,
        name,
        symbol,
        logo: info.logo,
        balance,
        slug: info.slug,
        address: token.address,
      }
    })

    const resultList = await Promise.all(listTokens)

    const tokenAPrice = await this.$axios.$get(
      coinMarketCapService.currencyRate,
      {
        params: { id: resultList[0].id, amount: 1 },
      }
    )

    const tokenBPrice = await this.$axios.$get(
      coinMarketCapService.currencyRate,
      {
        params: { id: resultList[1].id, amount: 1 },
      }
    )

    resultList[0] = {
      ...resultList[0],
      value: null,
      price: tokenAPrice.data.quote.USD,
    }

    resultList[1] = {
      ...resultList[1],
      value: null,
      price: tokenBPrice.data.quote.USD,
    }
    commit("SET_TOKENS", resultList)
  },
  async setCurrencyRate({ commit }, { id, type }) {
    const {
      data: {
        quote: { USD },
      },
    } = await this.$axios.$get(coinMarketCapService.currencyRate, {
      params: { id, amount: 1 },
    })

    commit("SET_CURRENCY_RATE", { type, rate: USD })
  },
  async getAmountOut({ commit, state }, value) {
    const {
      selectedTokens: { tokenA, tokenB },
    } = state

    commit("SET_EXCHANGE_LOADING", "tokenB")
    commit("SET_EMPTY_PAIR", null)

    try {
      const pairAddress = await this.$kaikas.factoryContract.methods
        .getPair(tokenA.address, tokenB.address)
        .call({
          from: this.$kaikas.address,
        })

      if (this.$kaikas.isEmptyAddress(pairAddress)) {
        commit("SET_EMPTY_PAIR", [tokenA.address, tokenB.address])
        commit("SET_EXCHANGE_LOADING", null)
        return
      }

      const pairContract = this.$kaikas.createContract(pairAddress, pair.abi)
      const reserves = await pairContract.methods.getReserves().call({
        from: this.$kaikas.address,
      })

      const getAmountOut = await this.$kaikas.routerContract.methods
        .getAmountOut(value.toString(), reserves[0], reserves[1])
        .call({
          from: this.$kaikas.address,
        })

      commit("SET_TOKEN_VALUE", { type: "tokenB", value: getAmountOut })
    } catch (e) {
      console.log(e)
    }

    commit("SET_EXCHANGE_LOADING", null)
  },
  async getAmountIn({ commit, state }, value) {
    const {
      selectedTokens: { tokenA, tokenB },
    } = state
    commit("SET_EXCHANGE_LOADING", "tokenA")

    try {
      const pairAddress = await this.$kaikas.factoryContract.methods
        .getPair(tokenA.address, tokenB.address)
        .call({
          from: this.$kaikas.address,
        })

      const pairContract = this.$kaikas.createContract(pairAddress, pair.abi)
      const reserves = await pairContract.methods.getReserves().call({
        from: this.$kaikas.address,
      })

      const getAmountOut = await this.$kaikas.routerContract.methods
        .getAmountIn(value.toString(), reserves[1], reserves[0])
        .call({
          from: this.$kaikas.address,
        })

      commit("SET_TOKEN_VALUE", { type: "tokenA", value: getAmountOut })
    } catch (e) {
      console.log(e)
    }

    commit("SET_EXCHANGE_LOADING", null)
  },
  async swapTokens({ state }) {
    console.log(state.computedToken)
  },
  // async getExchangeRate() { // TODO it needs when creating lq
  //   const {selectedTokens: {tokenA, tokenB}} = state
  //   try {
  //     const pairAddress = await this.$kaikas.factoryContract.methods.getPair(tokenA.address, tokenB.address)
  //       .call({
  //         from: this.$kaikas.address,
  //       })
  //     console.log({pairAddress})
  //
  //     // const pairAddress2 = await this.$kaikas.factoryContract.methods.createPair(tokenA.address, tokenB.address)
  //     //   .send({
  //     //     from: this.$kaikas.address,
  //     //     gas: 8500000,
  //     //     gasPrice: 750000000000,
  //     //   })
  //     // console.log({pairAddress2})
  //     // if(pairAddress.slice(2) === 0) {
  //     //   debugger
  //     // }
  //
  //     const pairContract = this.$kaikas.createContract(pairAddress, pair.abi)
  //     const reserves = await pairContract.methods.getReserves().call({
  //       from: this.$kaikas.address,
  //     })
  //
  //     const getAmountsOut = await this.$kaikas.routerContract.methods.getAmountsOut(
  //       "1000", [tokenA.address, tokenB.address]
  //     ).call({
  //       from: this.$kaikas.address,
  //     })
  //
  //     const getAmountOut = await this.$kaikas.routerContract.methods.getAmountOut(
  //       "1000", reserves[0], reserves[1]
  //     ).call({
  //       from: this.$kaikas.address,
  //     })
  //
  //     const getAmountIn = await this.$kaikas.routerContract.methods.getAmountIn(
  //       "1000", reserves[1], reserves[0]
  //     ).call({
  //       from: this.$kaikas.address,
  //     })
  //
  //     const getAmountsIn = await this.$kaikas.routerContract.methods.getAmountsIn(
  //       "1000", [tokenB.address, tokenA.address]
  //     ).call({
  //       from: this.$kaikas.address,
  //     })
  //
  //     console.log({getAmountsOut, getAmountOut, getAmountsIn, getAmountIn})
  //     debugger
  //   } catch (e) {
  //     console.log(e)
  //   }
  // },
}

export const mutations = {
  REFRESH_STORE(state) {
    state = {
      tokensList: [],
      exchangeRateLoading: null,
      pairNotExist: false,
      slippagePercent: 0.5,
      selectedTokens: {
        tokenA: null,
        tokenB: null,
      },
    }
    return state
  },
  SET_TOKENS(state, tokens) {
    state.tokensList = tokens
    state.selectedTokens = {
      tokenA: tokens[0],
      tokenB: tokens[1],
    }
  },
  SET_SELECTED_TOKEN(state, { type, token }) {
    state.selectedTokens = {
      ...state.selectedTokens,
      [type]: token,
    }
  },
  SET_CURRENCY_RATE(state, { type, rate }) {
    state.selectedTokens = {
      ...state.selectedTokens,
      [type]: {
        ...state.selectedTokens[type],
        price: rate,
      },
    }
  },
  SET_TOKEN_VALUE(state, { type, value }) {
    state.selectedTokens = {
      ...state.selectedTokens,
      [type]: {
        ...state.selectedTokens[type],
        value,
      },
    }
  },
  SET_EXCHANGE_LOADING(state, type) {
    state.exchangeRateLoading = type
  },
  SET_EMPTY_PAIR(state, tokens) {
    state.pairNotExist = tokens
  },
  SET_SLIPPAGE(state, value) {
    state.slippagePercent = value
  },
  SET_COMPUTED_TOKEN(state, token) {
    state.computedToken = token
  },
  SET_EXCHANGE_RATE_INTERVAL_ID(state, intervalID) {
    state.exchangeRateIntervalID = intervalID
  },
}
