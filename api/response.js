const respond = (res, result) => {
    res.status(result.statusCode);
    res.json(result);
    res.end();
}

module.exports = respond;