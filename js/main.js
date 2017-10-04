/**
 * Created by Peter Ryszkiewicz (https://github.com/pRizz) on 9/10/2017.
 * https://github.com/pRizz/My-IOTA-Balance
 */

const httpProviders = [
    "http://iota.bitfinex.com:80",
    "http://service.iotasupport.com:14265",
    "http://node01.iotatoken.nl:14265",
    "http://node02.iotatoken.nl:14265",
    "http://node03.iotatoken.nl:15265",
    "http://mainnet.necropaz.com:14500",
    "http://5.9.137.199:14265",
    "http://5.9.118.112:14265",
    "http://5.9.149.169:14265",
    "http://88.198.230.98:14265",
    "http://176.9.3.149:14265",
    "http://node.lukaseder.de:14265",
    "http://iota.preissler.me:80",
    "http://iotanode.prizziota.com:80", // author's node :)
]

const httpsProviders = [
    'https://iota.preissler.me:443',
    "https://iotanode.prizziota.com:443", // author's node :)
]

const iotaLib = window.IOTA
var iota = null

const validProviders = getValidProviders()
const currentProviderProxy = new Proxy({
    currentProvider: null
}, {
    set: function(obj, prop, value) {
        obj[prop] = value
        iota = new iotaLib({'provider': value})
        return true
    }
})
currentProviderProxy.currentProvider = getRandomProvider()

var usdPerMIOTA = null
var iotaBalance = null

// must be https if the hosting site is served over https; SSL rules
function getValidProviders() {
    if(isRunningOverHTTPS()) {
        return httpsProviders
    } else {
        return httpProviders.concat(httpsProviders)
    }
}

function isRunningOverHTTPS() {
    switch(window.location.protocol) {
        case 'https:':
            return true
        default:
            return false
    }
}

function getBalances() {
    const addressesToSearchRaw = $('#addressesToGetBalance')[0].value.split('\n')
    const addressesLessEmptyLines = addressesToSearchRaw.filter((element) => {return element.length != 0})

    if (addressesLessEmptyLines.length == 0) {
        return handleNoAddresses()
    }

    for (const address of addressesLessEmptyLines) {
        if (address.length != 90) {
            return handleInvalidAddress(address)
        }
    }

    $('#totalBalance')[0].innerText = "Loading..."
    $('#totalBalanceToUSD')[0].innerText = ""

    iota.api.getBalances(addressesLessEmptyLines, 100, function(error, success){
        if(error || !success) {
            return handleRetrievalError(error)
        }
        if(!success.balances) {
            return handleRetrievalError("Missing balances property in response")
        }

        iotaBalance = success.balances.map((el) => { return parseInt(el) }).reduce((sum, value) => { return sum + value })
        const totalBalanceLocalized = iotaBalance.toLocaleString()
        $('#totalBalance')[0].innerText = `${totalBalanceLocalized} IOTA`
        updateBalanceInUSD()

        history.pushState(null, '', '/My-IOTA-Balance/?addresses=' + addressesLessEmptyLines.join(','))
    })
}

function updateBalanceInUSD() {
    if(!usdPerMIOTA) { return }
    if(!iotaBalance) { return }

    const iotaPerMIOTA = 1000000
    const usdBalance = iotaBalance / iotaPerMIOTA * usdPerMIOTA
    const digitsToShow = usdBalance > 1 ? 2 : usdBalance > 0.001 ? 5 : 9
    const usdBalanceString = usdBalance.toLocaleString(undefined, {
        maximumFractionDigits: digitsToShow
    })
    $('#totalBalanceToUSD')[0].innerText = `\$${usdBalanceString} @ ${usdPerMIOTA.toFixed(4)} USD/MIOTA`
}

function handleRetrievalError(error) {
    $('#retrievalErrorPre')[0].innerText = error
    $('#retrievalErrorModal').modal('show')
}

function handleNoAddresses() {
    $('#noAddressesModal').modal('show')
}

function handleInvalidAddress(invalidAddress) {
    $('#invalidAddress')[0].innerText = invalidAddress
    $('#invalidAddressModal').modal('show')
}

$(function(){
    const queryParams = window.location.search.split()
    // TODO: Utilize URLSearchParams; include a way to save host
    if(window.location.search.includes("addresses")) {
        const addresses = window.location.search.split("=")[1].split(",")
        $('#addressesToGetBalance')[0].value = addresses.join("\n")
        getBalances()
    }

    function initializeIOTAPriceWebSocket() {
        var priceWS = new WebSocket('wss://api.bitfinex.com/ws/2')
        priceWS.addEventListener('open', () => {
            priceWS.send(JSON.stringify({
                event: "subscribe",
                channel: "ticker",
                pair: "IOTUSD"
            }))
        })
        priceWS.addEventListener('message', (message) => {
            const iotaPriceData = JSON.parse(message.data)
            if(iotaPriceData && iotaPriceData[1] && iotaPriceData[1][6]) {
                usdPerMIOTA = iotaPriceData[1][6] // see https://bitfinex.readme.io/v2/reference#ws-public-ticker
                updateBalanceInUSD()
            }
        })

        priceWS.addEventListener('error', (error) => {
            console.error("Received error while fetching prices from Bitfinex: ", error)
            setTimeout(() => {
                initializeIOTAPriceWebSocket()
            }, 60000)
        })
    }

    initializeIOTAPriceWebSocket()

    if(!isRunningOverHTTPS()) {
        $('#httpWarningAlert').removeClass('hidden')
    }
})

function getRandomProvider() {
    return validProviders[Math.floor(Math.random() * validProviders.length)]
}

const app = angular.module("totalBalanceApp", [])
app.controller("hostDropdownController", function($scope) {
    $scope.hostList = validProviders
    $scope.selectedHost = currentProviderProxy.currentProvider
    $scope.$watch('selectedHost', (newValue) => {
        currentProviderProxy.currentProvider = newValue
    })
})
