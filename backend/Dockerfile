FROM python:3.11-slim

WORKDIR /app

COPY requirements-bootstrap.txt requirements.txt ./

# pip y certifi nuevos, verificados por hash (ver requirements-bootstrap.txt)
RUN pip install --no-cache-dir --require-hashes -r requirements-bootstrap.txt \
    && pip install --no-cache-dir -r requirements.txt

COPY . .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 8000

CMD ["./entrypoint.sh"]
